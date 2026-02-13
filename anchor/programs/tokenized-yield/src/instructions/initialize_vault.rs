use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

pub use crate::states::Vault;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        mint::decimals = 6,
        mint::authority = vault_signer.key(),
        mint::freeze_authority = vault_signer.key(),
        seeds = [b"vault_share_mint", vault.key().as_ref()],
        bump
    )]
    pub vault_share_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        seeds = [b"vault_signer", vault.key().as_ref()],
        bump,
        payer = owner,
        space = 8,
    )]
    /// CHECK: PDA signer
    pub vault_signer: UncheckedAccount<'info>,

    #[account(
        init,
        token::mint = payment_mint,
        token::authority = vault_signer,
        seeds = [b"payment-vault", vault.key().as_ref()],
        bump,
        payer = owner
    )]
    pub payment_vault: Account<'info, TokenAccount>,

    pub payment_mint: Account<'info, Mint>,

    #[account(
        init,
        token::mint = vault_share_mint,
        token::authority = vault_signer,
        seeds = [b"revenue-vault", vault.key().as_ref()],
        bump,
        payer = owner
    )]
    pub revenue_vault: Account<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn process_initialize_vault(
    ctx: Context<InitializeVault>,
    name: String,
    total_shares: u64,
    price_per_share: u64,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.owner = *ctx.accounts.owner.key;
    vault.name = name;

    vault.vault_share_mint = ctx.accounts.vault_share_mint.key();
    vault.payment_mint = ctx.accounts.payment_mint.key();
    vault.payment_vault = ctx.accounts.payment_vault.key();
    vault.revenue_vault = ctx.accounts.revenue_vault.key();

    vault.total_shares = total_shares;
    vault.minted_shares = 0;
    vault.price_per_share = price_per_share;

    vault.account_revenue_per_share = 0;
    vault.bump = ctx.bumps.vault;
    vault.signer_bump = ctx.bumps.vault_signer;

    Ok(())
}
