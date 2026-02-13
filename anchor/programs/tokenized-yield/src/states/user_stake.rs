use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserStake {
    pub is_initialized: bool,
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub quantity: u64,

    pub reward_debt: u128,
    pub bump: u8,
}
