use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, TransferChecked, Mint, TokenAccount, Token},
};

use crate::error::ErrorCode;
use crate::state::{Escrow, DepositRecord, DepositState, Stable, SignaturePolicy, USDC_MINT_ADDR, USDT_MINT_ADDR, EscrowState, AuthorizedBy};

#[derive(Accounts)]
#[instruction(stable: Stable, authorization: AuthorizedBy)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"escrow", escrow.sender.as_ref(), escrow.receiver.as_ref()], bump = escrow.bump)]
    pub escrow: Box<Account<'info, Escrow>>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    /// CHECK: we're just storing the pubkey
    pub counterparty: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_usdt_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = counterparty,
        associated_token::token_program = token_program
    )]
    pub counterparty_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = counterparty,
        associated_token::token_program = token_program
    )]
    pub counterparty_usdt_ata: Account<'info, TokenAccount>,

     #[account(
        mint::token_program = token_program,
        // Accept either mainnet or devnet USDC mint
        constraint = (
            usdc_mint.key() == Pubkey::from_str(USDC_MINT_ADDR).unwrap() || 
            usdc_mint.key() == Pubkey::from_str("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr").unwrap()
        ) @ ErrorCode::InvalidUsdcMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mint::token_program = token_program,
        // Accept either mainnet or devnet USDT mint
        constraint = (
            usdt_mint.key() == Pubkey::from_str(USDT_MINT_ADDR).unwrap() ||
            usdt_mint.key() == Pubkey::from_str("J2B12TxqtZkXtMAPY1BX2noiTSDNrz4VqiKfU5Sh9t5d").unwrap()
        ) @ ErrorCode::InvalidUsdtMint
    )]
    pub usdt_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = escrow,
        seeds = [b"usdc-vault", escrow.key().as_ref(), usdc_mint.key().as_ref()],
        bump,
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdt_mint,
        token::authority = escrow,
        seeds = [b"usdt-vault", escrow.key().as_ref(), usdt_mint.key().as_ref()],
        bump,
  )]
    pub vault_usdt: Account<'info, TokenAccount>,

    /// CHECK: This account is only used to pay for account creation fees and rent
    #[account(mut, signer)]
    pub fee_payer: AccountInfo<'info>,

    #[account(
        init,
        payer = fee_payer,
        space = 8 + DepositRecord::INIT_SPACE,
        seeds = [b"deposit", escrow.key().as_ref(), escrow.deposit_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub deposit_record: Box<Account<'info, DepositRecord>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


impl<'info> Deposit<'info> {

    pub fn deposit(&mut self,
        stable: Stable,
        authorization: AuthorizedBy,
        bump: &DepositBumps,
        amount: u64,
    ) -> Result<()> {
        require!(
           self.escrow.state == EscrowState::Active,
           ErrorCode::InvalidState
        );
        // @todo change specific mints to simply SPLs

        let escrow = &mut self.escrow;
        
        let deposit_idx = escrow.deposit_count;

        // Verify the depositor is either the sender or receiver
        let is_sender = self.depositor.key() == escrow.sender;
        let is_receiver = self.depositor.key() == escrow.receiver;
        require!(is_sender || is_receiver, ErrorCode::InvalidDepositor);
        
        // Verify the counterparty is the other party
        if is_sender {
            require!(self.counterparty.key() == escrow.receiver, ErrorCode::InvalidCounterparty);
        } else {
            require!(self.counterparty.key() == escrow.sender, ErrorCode::InvalidCounterparty);
        }

        // Convert from AuthorizedBy to SignaturePolicy and store for later use during release
        // This creates a clean separation between who makes the deposit (only depositor signs)
        // and who is authorized to release the funds (determined by this policy)
        let policy = match authorization {
            AuthorizedBy::Both => SignaturePolicy::Dual,
            AuthorizedBy::Sender => SignaturePolicy::Single { signer: escrow.sender },
            AuthorizedBy::Receiver => SignaturePolicy::Single { signer: escrow.receiver },
        };

        // Store deposit index in the record
        self.deposit_record.set_inner(DepositRecord {
            escrow: escrow.key(),
            deposit_idx,
            amount,
            policy,
            bump: bump.deposit_record,
            stable: stable.clone(),
            state: DepositState::PendingWithdrawal,
        });

        // Process token transfer
        let (from_info, mint_info, to_info, decimals) = match stable {
            Stable::Usdc => (
                self.depositor_usdc_ata.to_account_info(),
                self.usdc_mint.to_account_info(),
                self.vault_usdc.to_account_info(),
                self.usdc_mint.decimals,
            ),
            Stable::Usdt => (
                self.depositor_usdt_ata.to_account_info(),
                self.usdt_mint.to_account_info(),
                self.vault_usdt.to_account_info(),
                self.usdt_mint.decimals,
            ),
        };

        // Execute the transfer
        let cpi_accounts = TransferChecked {
            from: from_info,
            mint: mint_info,
            to: to_info,
            authority: self.depositor.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        transfer_checked(cpi_ctx, amount, decimals)?;

        // Update escrow balances
        match stable {
            Stable::Usdc => self.escrow.deposited_usdc += amount,
            Stable::Usdt => self.escrow.deposited_usdt += amount,
        }
        self.escrow.deposit_count += 1;

        Ok(())
    }
}
