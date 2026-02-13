use anchor_lang::prelude::*;
use crate::{Vault, error::ErrorCode};
use crate::states::vault::MAX_PERFORMANCE_FEE_BPS;

#[derive(Accounts)]
pub struct UpdatePerformanceFee<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = authority.key() == vault.authority @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,
}

pub fn process_update_performance_fee(
    ctx: Context<UpdatePerformanceFee>,
    new_fee_bps: u16,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // Check if governance is disabled
    require!(
        !vault.is_governance_disabled(),
        ErrorCode::GovernanceDisabled
    );

    // Validate fee boundedness (max 20%)
    require!(
        new_fee_bps <= MAX_PERFORMANCE_FEE_BPS,
        ErrorCode::PerformanceFeeExceedsMax
    );

    // Update performance fee
    vault.performance_fee_bps = new_fee_bps;

    Ok(())
}
