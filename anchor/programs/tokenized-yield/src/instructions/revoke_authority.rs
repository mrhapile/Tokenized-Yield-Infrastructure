use anchor_lang::prelude::*;
use crate::{Vault, error::ErrorCode};

#[derive(Accounts)]
pub struct RevokeAuthority<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = authority.key() == vault.authority @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Irreversibly revokes governance authority.
/// After calling this, all governance operations will fail permanently.
/// The protocol parameters become immutable.
pub fn process_revoke_authority(ctx: Context<RevokeAuthority>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // Check if governance is already disabled
    require!(
        !vault.is_governance_disabled(),
        ErrorCode::GovernanceDisabled
    );

    // Set authority to default (zero) - IRREVERSIBLE
    // This permanently disables all governance operations
    vault.authority = Pubkey::default();

    Ok(())
}
