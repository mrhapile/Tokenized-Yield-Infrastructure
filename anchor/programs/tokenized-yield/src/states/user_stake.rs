use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserStake {
    pub is_initialized: bool,
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub quantity: u32,
    pub pay_amount: u64,
    pub debt_claimed: u128,
    pub bump: u8,
}
