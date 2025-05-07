#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

mod instructions;
use instructions::*;
mod error;
mod state;

declare_id!("HyavU5k2jA2D2oPUX7Ct8kUhXJQGaTum4nqnLW7f77wL");

#[program]
pub mod senda_dapp {
    use super::*;

    pub fn init_factory(ctx: Context<InitializeFactory>) -> Result<()> {
        ctx.accounts.init_factory(&ctx.bumps)
    }

    pub fn initialize_escrow(ctx: Context<InitializeEscrow>, seed: u64) -> Result<()> {
        ctx.accounts.init_escrow(seed, &ctx.bumps)
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        stable: state::Stable,
        authorization: state::AuthorizedBy,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.deposit(stable, authorization, &ctx.bumps, amount)
    }

    pub fn cancel(ctx: Context<Cancel>, deposit_idx: u64) -> Result<()> {
        ctx.accounts.cancel(deposit_idx)
    }

    pub fn release(ctx: Context<Release>, deposit_idx: u64) -> Result<()> {
        ctx.accounts.release(deposit_idx)
    }
}