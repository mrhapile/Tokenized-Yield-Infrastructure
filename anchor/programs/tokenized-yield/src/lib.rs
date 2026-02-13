#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
declare_id!("HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j");

pub mod instructions;
pub use instructions::*;

pub mod states;
pub use states::*;

pub mod error;

pub mod constants;

#[program]
pub mod tokenized_yield_infrastructure {
    use super::*;
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        name: String,
        total_shares: u64,
        price_per_share: u64,
        performance_fee_bps: u16,
    ) -> Result<()> {
        instructions::process_initialize_vault(ctx, name, total_shares, price_per_share, performance_fee_bps)
    }
    pub fn mint_shares(ctx: Context<MintShares>, amount: u64) -> Result<()> {
        instructions::process_mint_shares(ctx, amount)
    }

    pub fn deposit_revenue(ctx: Context<DepositRevenue>, amount: u64) -> Result<()> {
        instructions::process_deposit_revenue(ctx, amount)
    }

    pub fn harvest(ctx: Context<Harvest>) -> Result<()> {
        instructions::process_harvest(ctx)
    }

    pub fn redeem_shares(ctx: Context<RedeemShares>, amount: u64) -> Result<()> {
        instructions::process_redeem_shares(ctx, amount)
    }

    // =========================================================================
    // GOVERNANCE INSTRUCTIONS
    // =========================================================================

    /// Update performance fee (authority only, max 20%)
    pub fn update_performance_fee(ctx: Context<UpdatePerformanceFee>, new_fee_bps: u16) -> Result<()> {
        instructions::process_update_performance_fee(ctx, new_fee_bps)
    }

    /// Update treasury account (authority only, must maintain capital segregation)
    pub fn update_treasury(ctx: Context<UpdateTreasury>) -> Result<()> {
        instructions::process_update_treasury(ctx)
    }

    /// Transfer governance authority to new address
    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::process_transfer_authority(ctx, new_authority)
    }

    /// Irreversibly revoke governance authority - protocol becomes immutable
    pub fn revoke_authority(ctx: Context<RevokeAuthority>) -> Result<()> {
        instructions::process_revoke_authority(ctx)
    }
}
