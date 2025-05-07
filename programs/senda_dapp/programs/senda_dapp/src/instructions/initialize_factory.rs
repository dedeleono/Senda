use crate::state::Factory;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        seeds = [b"factory", authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + Factory::INIT_SPACE,
    )]
    pub factory: Account<'info, Factory>,

    /// CHECK: PDA used as the mint authority
    #[account(
        seeds = [b"mint_auth", factory.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeFactory<'info> {
    pub fn init_factory(&mut self, bumps: &InitializeFactoryBumps) -> Result<()> {
        let factory_bump = bumps.factory;
        let mint_auth_bump = bumps.mint_authority;

        self.factory.set_inner(Factory {
            admin: self.authority.key(),
            factory_bump,
            mint_authority: self.mint_authority.key(),
            mint_auth_bump,
            escrow_count: 0,
        });

        Ok(())
    }
}
