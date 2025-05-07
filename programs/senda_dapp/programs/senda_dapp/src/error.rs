use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // === Authentication Errors ===
    #[msg("Authorization error: Invalid signer for this policy")]  
    InvalidSigner,
    
    // === Account Validation Errors ===
    #[msg("Account validation error: Invalid USDC mint address")]  
    InvalidUsdcMint,
    
    #[msg("Account validation error: Invalid USDT mint address")]  
    InvalidUsdtMint,
    
    #[msg("Account validation error: Depositor must be either the sender or receiver of the escrow")]
    InvalidDepositor,
    
    #[msg("Account validation error: Counterparty must be the other party of the escrow")]
    InvalidCounterparty,
    
    #[msg("Account validation error: Invalid parties for this escrow transaction")]
    InvalidParties,
    
    // === State Validation Errors ===
    #[msg("State error: Invalid escrow or deposit state for this operation")]
    InvalidState,
    
    #[msg("Policy error: Invalid signature policy configuration")]
    InvalidPolicy,
    
    #[msg("Deposit error: Deposit index not found")]
    DepositNotFound,
    
    #[msg("Deposit error: Deposit has already been processed")]
    DepositAlreadyProcessed,
} 