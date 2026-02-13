use anchor_lang::prelude::*;
use crate::{Vault, error::ErrorCode};

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = authority.key() == vault.authority @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,
}

pub fn process_transfer_authority(
    ctx: Context<TransferAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // Check if governance is disabled
    require!(
        !vault.is_governance_disabled(),
        ErrorCode::GovernanceDisabled
    );

    // New authority cannot be zero address (use revoke_authority for that)
    require!(
        new_authority != Pubkey::default(),
        ErrorCode::InvalidAuthority
    );

    // Transfer authority
    vault.authority = new_authority;

    Ok(())
}
