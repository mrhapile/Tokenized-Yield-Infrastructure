use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use crate::{Vault, error::ErrorCode};

#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = authority.key() == vault.authority @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    /// New treasury account - must be owned by vault_signer PDA
    #[account(
        constraint = new_treasury.mint == vault.payment_mint @ ErrorCode::InvalidTreasury,
        constraint = new_treasury.owner == vault_signer.key() @ ErrorCode::InvalidTreasury
    )]
    pub new_treasury: Account<'info, TokenAccount>,

    /// CHECK: PDA signer for ownership verification
    #[account(
        seeds = [b"vault_signer", vault.key().as_ref()],
        bump = vault.signer_bump
    )]
    pub vault_signer: UncheckedAccount<'info>,
}

pub fn process_update_treasury(ctx: Context<UpdateTreasury>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // Check if governance is disabled
    require!(
        !vault.is_governance_disabled(),
        ErrorCode::GovernanceDisabled
    );

    // Update treasury - new_treasury is validated by account constraints
    // This preserves capital segregation as new treasury must be:
    // 1. Owned by vault_signer PDA (same authority as revenue/principal vaults)
    // 2. Using the same payment_mint
    vault.treasury = ctx.accounts.new_treasury.key();

    Ok(())
}
