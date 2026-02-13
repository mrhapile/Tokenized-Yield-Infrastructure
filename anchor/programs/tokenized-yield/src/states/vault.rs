use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    #[max_len(50)]
    pub name: String,

    pub vault_share_mint: Pubkey,

    // vaults
    pub payment_mint: Pubkey,
    pub payment_vault: Pubkey,
    pub revenue_vault: Pubkey,

    pub total_shares: u64,
    pub minted_shares: u64,
    pub price_per_share: u64,

    pub acc_reward_per_share: u128,

    pub bump: u8,
    pub signer_bump: u8,
}
