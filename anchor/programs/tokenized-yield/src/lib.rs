#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
declare_id!("HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j");

pub mod instructions;
pub use instructions::*;

pub mod states;
pub use states::*;

pub mod error;

#[program]
pub mod tokenized_yield_infrastructure {
    use super::*;
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        name: String,
        total_shares: u64,
        price_per_share: u64,
    ) -> Result<()> {
        instructions::process_initialize_vault(ctx,name, total_shares, price_per_share)
    }
    pub fn mint_shares(ctx: Context<MintShares>, amount: u64, pay_amount: u64) -> Result<()> {
        instructions::process_mint_shares(ctx, amount, pay_amount)
    }
}
