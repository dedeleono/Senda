use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, TransferChecked, Mint, TokenAccount, Token},
};

use crate::error::ErrorCode;
use crate::state::{Escrow, DepositState, DepositRecord, USDC_MINT_ADDR, USDT_MINT_ADDR, EscrowState, Stable};

#[derive(Accounts)]
#[instruction(deposit_idx: u64)]
pub struct Cancel<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.sender.as_ref(), escrow.receiver.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    // The original depositor who made the deposit
    #[account(mut)]
    pub original_depositor: Signer<'info>,

    /// CHECK: Counterparty wallet, not accessed in this instruction
    pub counterparty: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = original_depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = original_depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_usdt_ata: Account<'info, TokenAccount>,

    #[account(
        mint::token_program = token_program,
        constraint = (
            usdc_mint.key() == Pubkey::from_str(USDC_MINT_ADDR).unwrap() || 
            usdc_mint.key() == Pubkey::from_str("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr").unwrap()
        ) @ ErrorCode::InvalidUsdcMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mint::token_program = token_program,
        constraint = (
            usdt_mint.key() == Pubkey::from_str(USDT_MINT_ADDR).unwrap() ||
            usdt_mint.key() == Pubkey::from_str("J2B12TxqtZkXtMAPY1BX2noiTSDNrz4VqiKfU5Sh9t5d").unwrap()
        ) @ ErrorCode::InvalidUsdtMint
    )]
    pub usdt_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"usdc-vault", escrow.key().as_ref(), usdc_mint.key().as_ref()],
        bump = escrow.vault_usdc_bump,
        token::mint = usdc_mint,
        token::authority = escrow,
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"usdt-vault", escrow.key().as_ref(), usdt_mint.key().as_ref()],
        bump = escrow.vault_usdt_bump,
        token::mint = usdt_mint,
        token::authority = escrow,
    )]
    pub vault_usdt: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = deposit_record.escrow == escrow.key() @ ErrorCode::InvalidState,
        constraint = deposit_record.deposit_idx == deposit_idx @ ErrorCode::DepositNotFound,
        constraint = deposit_record.state == DepositState::PendingWithdrawal @ ErrorCode::InvalidState,
        seeds = [b"deposit", escrow.key().as_ref(), deposit_idx.to_le_bytes().as_ref()],
        bump = deposit_record.bump,
    )]
    pub deposit_record: Account<'info, DepositRecord>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> Cancel<'info> {
    
    pub fn cancel(&mut self, _deposit_idx: u64) -> Result<()> {
        // 1. Verify the escrow is active
        require!(
            self.escrow.state == EscrowState::Active,
            ErrorCode::InvalidState
        );

        // 2. Verify the original_depositor is one of the escrow parties
        let is_sender = self.original_depositor.key() == self.escrow.sender;
        let is_receiver = self.original_depositor.key() == self.escrow.receiver;
        require!(is_sender || is_receiver, ErrorCode::InvalidDepositor);
        
        // 3. Verify the counterparty is the other party
        if is_sender {
            require!(self.counterparty.key() == self.escrow.receiver, ErrorCode::InvalidCounterparty);
        } else {
            require!(self.counterparty.key() == self.escrow.sender, ErrorCode::InvalidCounterparty);
        }

        // 4. Determine which token type to return
        let (amount, mint, vault, decimals) = if self.deposit_record.stable == Stable::Usdc {
            (
                self.deposit_record.amount,
                self.usdc_mint.to_account_info(),
                self.vault_usdc.to_account_info(),
                self.usdc_mint.decimals,
            )
        } else {
            (
                self.deposit_record.amount,
                self.usdt_mint.to_account_info(),
                self.vault_usdt.to_account_info(), 
                self.usdt_mint.decimals,
            )
        };

        // 5. Prepare the transfer back to the original depositor
        let cpi_accounts = TransferChecked {
            from: vault,
            mint,
            to: if self.deposit_record.stable == Stable::Usdc {
                self.depositor_usdc_ata.to_account_info()
            } else {
                self.depositor_usdt_ata.to_account_info()
            },
            authority: self.escrow.to_account_info(),
        };

        // 6. Create the PDA signer seeds
        let escrow_seeds: [&[u8]; 4] = [
            b"escrow".as_ref(),
            self.escrow.sender.as_ref(),
            self.escrow.receiver.as_ref(),
            &[self.escrow.bump],
        ];
        let seeds_slice: &[&[u8]] = &escrow_seeds;
        
        // 7. Execute the transfer
        let signer_seeds = &[seeds_slice];
        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        transfer_checked(cpi_ctx, amount, decimals)?;

        // 8. Update escrow balances
        match self.deposit_record.stable {
            Stable::Usdc => {
                self.escrow.deposited_usdc = self.escrow.deposited_usdc.checked_sub(amount).unwrap_or(0);
            },
            Stable::Usdt => {
                self.escrow.deposited_usdt = self.escrow.deposited_usdt.checked_sub(amount).unwrap_or(0);
            },
        }

        // 9. Mark deposit as cancelled
        self.deposit_record.state = DepositState::Cancelled;
        
        Ok(())
    }
}
