use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, transfer};
use crate::{UserStake, Vault, error::ErrorCode, constants::PRECISION};

#[derive(Accounts)]
pub struct Harvest<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    /// CHECK: PDA Signer
    #[account(
        seeds = [b"vault_signer", vault.key().as_ref()],
        bump = vault.signer_bump
    )]
    pub vault_signer: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = shareholder.owner == payer.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = shareholder.vault == vault.key() @ ErrorCode::InvalidShareholder
    )]
    pub shareholder: Account<'info, UserStake>,

    #[account(
        mut,
        constraint = payment_vault.mint == vault.payment_mint @ ErrorCode::InvalidPaymentMint,
        constraint = payment_vault.owner == vault_signer.key() @ ErrorCode::InvalidPaymentVault
    )]
    pub payment_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_ata.mint == vault.payment_mint @ ErrorCode::InvalidPaymentMint,
        constraint = user_ata.owner == payer.key() @ ErrorCode::InvalidTokenAccountOwner
    )]
    pub user_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn process_harvest(ctx: Context<Harvest>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let shareholder = &mut ctx.accounts.shareholder;
    let payment_vault = &mut ctx.accounts.payment_vault;
    let user_ata = &mut ctx.accounts.user_ata;
    let token_program = &ctx.accounts.token_program;
    let vault_signer = &ctx.accounts.vault_signer;

    // Compute pending reward
    let accumulated = (shareholder.quantity as u128)
        .checked_mul(vault.acc_reward_per_share)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    let pending = accumulated
        .checked_sub(shareholder.reward_debt)
        .ok_or(ErrorCode::Underflow)?;

    if pending > 0 {
        let pending_u64 = u64::try_from(pending).map_err(|_| ErrorCode::Overflow)?;

        // Solvency check
        require!(
            payment_vault.amount >= pending_u64,
            ErrorCode::InsufficientVaultBalance
        );

        // Update reward debt BEFORE transfer (CEI pattern)
        shareholder.reward_debt = accumulated;

        // Transfer pending to user
        let vault_key = vault.key();
        let seeds = &[b"vault_signer".as_ref(), vault_key.as_ref(), &[vault.signer_bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: payment_vault.to_account_info(),
            to: user_ata.to_account_info(),
            authority: vault_signer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);
        token::transfer(cpi_ctx, pending_u64)?;
    } else {
        // Even if 0 pending, update debt to current accumulator
        shareholder.reward_debt = accumulated;
    }

    Ok(())
}
