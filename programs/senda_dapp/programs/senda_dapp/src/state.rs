use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
#[derive(InitSpace)]
pub enum Stable {
    Usdc,
    Usdt,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
#[derive(InitSpace)]
pub enum EscrowState {
    Active,
    Closed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
#[derive(InitSpace)]
pub enum DepositState {
    PendingWithdrawal,
    Complete,
    Disputed,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Factory {
    pub admin:        Pubkey,
    pub factory_bump: u8,
    pub mint_authority:   Pubkey,
    pub mint_auth_bump:   u8,
    pub escrow_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub seed: u64,

    pub sender: Pubkey,
    pub receiver: Pubkey,

    pub usdc_mint: Pubkey,
    pub usdt_mint: Pubkey,

    pub vault_usdc: Pubkey,
    pub vault_usdt: Pubkey,

    pub bump: u8,
    pub vault_usdc_bump: u8,
    pub vault_usdt_bump: u8,

    pub deposited_usdc: u64,
    pub deposited_usdt: u64,
    pub deposit_count: u64,

    pub state: EscrowState,
}

#[account]
#[derive(InitSpace)]
pub struct DepositRecord {
    pub escrow: Pubkey,
    pub deposit_idx: u64,
    pub amount: u64,
    pub policy: SignaturePolicy,
    pub bump: u8,
    pub stable: Stable,
    pub state: DepositState,
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone, PartialEq)]
#[derive(InitSpace)]
pub enum SignaturePolicy {
    Dual,
    Single {
        signer: Pubkey
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
#[derive(InitSpace)]
pub enum AuthorizedBy {
    Sender,
    Receiver,
    Both
}

impl AuthorizedBy {
    pub fn to_policy(&self, sender: Pubkey, receiver: Pubkey) -> SignaturePolicy {
        match self {
            AuthorizedBy::Sender => SignaturePolicy::Single { signer: sender },
            AuthorizedBy::Receiver => SignaturePolicy::Single { signer: receiver },
            AuthorizedBy::Both => SignaturePolicy::Dual,
        }
    }
}

pub const USDC_MINT_ADDR: &str = "EPjFWdd5AufqSSqeM2qctBxi8LoRBdQkj6mjjFG2Afa";
pub const USDT_MINT_ADDR: &str = "Es9vMFrzaCERnAawET5VsmZ6T4dQW5Ad9asmaaAEA7ZT";