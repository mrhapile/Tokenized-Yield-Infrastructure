use anchor_lang::prelude::*;

/// Maximum performance fee in basis points (20% = 2000 bps)
pub const MAX_PERFORMANCE_FEE_BPS: u16 = 2000;
/// Basis points denominator (100% = 10_000 bps)
pub const FEE_BPS_DENOMINATOR: u64 = 10_000;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    #[max_len(50)]
    pub name: String,

    pub vault_share_mint: Pubkey,

    // vaults
    pub payment_mint: Pubkey,
    pub principal_vault: Pubkey,
    pub revenue_vault: Pubkey,

    pub total_shares: u64,
    pub minted_shares: u64,
    pub price_per_share: u64,

    pub acc_reward_per_share: u128,
    pub reward_remainder: u128,

    // Performance Fee Layer
    /// Performance fee in basis points (e.g., 1000 = 10%)
    pub performance_fee_bps: u16,
    /// Treasury account that receives performance fees
    pub treasury: Pubkey,
    /// Total fees collected (for Protocol Revenue Invariant verification)
    pub total_fees_collected: u64,

    pub bump: u8,
    pub signer_bump: u8,
}
