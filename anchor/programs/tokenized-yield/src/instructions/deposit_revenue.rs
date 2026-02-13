use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};
use crate::{Vault, error::ErrorCode, constants::PRECISION};
use crate::states::vault::FEE_BPS_DENOMINATOR;

#[derive(Accounts)]
pub struct DepositRevenue<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = payer_ata.mint == vault.payment_mint @ ErrorCode::InvalidPaymentMint,
        constraint = payer_ata.owner == payer.key() @ ErrorCode::InvalidTokenAccountOwner
    )]
    pub payer_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = revenue_vault.key() == vault.revenue_vault @ ErrorCode::InvalidPaymentVault,
        constraint = revenue_vault.owner == vault_signer.key() @ ErrorCode::InvalidPaymentVault
    )]
    pub revenue_vault: Account<'info, TokenAccount>,

    /// Treasury account that receives performance fees
    #[account(
        mut,
        constraint = treasury.key() == vault.treasury @ ErrorCode::InvalidTreasury,
        constraint = treasury.owner == vault_signer.key() @ ErrorCode::InvalidTreasury
    )]
    pub treasury: Account<'info, TokenAccount>,

    /// CHECK: PDA Signer for payment vault check
    #[account(
        seeds = [b"vault_signer", vault.key().as_ref()],
        bump = vault.signer_bump
    )]
    pub vault_signer: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn process_deposit_revenue(ctx: Context<DepositRevenue>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.minted_shares > 0, ErrorCode::NoSharesMinted);
    require!(amount > 0, ErrorCode::InvalidRevenueAmount);

    // ============================================================
    // PERFORMANCE FEE CALCULATION
    // ============================================================
    // Formula: performance_fee = revenue * fee_bps / 10_000
    //          distributable_amount = revenue - performance_fee
    // ============================================================
    
    let performance_fee = (amount as u128)
        .checked_mul(vault.performance_fee_bps as u128)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(FEE_BPS_DENOMINATOR as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    let distributable_amount = amount
        .checked_sub(performance_fee)
        .ok_or(ErrorCode::Underflow)?;

    // ============================================================
    // TRANSFER PERFORMANCE FEE TO TREASURY (if fee > 0)
    // ============================================================
    if performance_fee > 0 {
        let cpi_accounts_treasury = Transfer {
            from: ctx.accounts.payer_ata.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program_treasury = ctx.accounts.token_program.to_account_info();
        transfer(CpiContext::new(cpi_program_treasury, cpi_accounts_treasury), performance_fee)?;

        // Update total fees collected (for Protocol Revenue Invariant)
        vault.total_fees_collected = vault.total_fees_collected
            .checked_add(performance_fee)
            .ok_or(ErrorCode::Overflow)?;
    }

    // ============================================================
    // TRANSFER DISTRIBUTABLE AMOUNT TO REVENUE VAULT
    // ============================================================
    if distributable_amount > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.payer_ata.to_account_info(),
            to: ctx.accounts.revenue_vault.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        transfer(CpiContext::new(cpi_program, cpi_accounts), distributable_amount)?;
    }

    // ============================================================
    // REWARD DISTRIBUTION MATH (UNCHANGED)
    // Uses distributable_amount ONLY for accumulator update
    // ============================================================

    // Skip accumulator update if no distributable amount
    if distributable_amount == 0 {
        return Ok(());
    }

    // Multiplication safety bound
    require!(
        (distributable_amount as u128) <= u128::MAX / PRECISION,
        ErrorCode::Overflow
    );

    // Compute scaled reward and remainder using DISTRIBUTABLE_AMOUNT only
    let scaled = (distributable_amount as u128)
        .checked_mul(PRECISION)
        .ok_or(ErrorCode::Overflow)?;

    let minted_shares_u128 = vault.minted_shares as u128;
    let reward_increment = scaled
        .checked_div(minted_shares_u128)
        .ok_or(ErrorCode::MathOverflow)?;
    
    let remainder = scaled
        .checked_rem(minted_shares_u128)
        .ok_or(ErrorCode::MathOverflow)?;

    // Update accumulator with overflow guard
    let new_acc = vault
        .acc_reward_per_share
        .checked_add(reward_increment)
        .ok_or(ErrorCode::Overflow)?;
    
    // Explicit ceiling guard (monotonicity check mostly, but also wraps)
    require!(
        new_acc >= vault.acc_reward_per_share,
        ErrorCode::Overflow
    );
    vault.acc_reward_per_share = new_acc;

    // Track remainder and distribute if enough accumulates
    let new_remainder = vault.reward_remainder
        .checked_add(remainder)
        .ok_or(ErrorCode::Overflow)?;
    
    if new_remainder >= minted_shares_u128 {
        let remainder_increment = new_remainder
            .checked_div(minted_shares_u128)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let new_acc_rem = vault.acc_reward_per_share
             .checked_add(remainder_increment)
             .ok_or(ErrorCode::Overflow)?;
        
        vault.acc_reward_per_share = new_acc_rem;
        vault.reward_remainder = new_remainder
            .checked_rem(minted_shares_u128)
            .ok_or(ErrorCode::MathOverflow)?;
    } else {
        vault.reward_remainder = new_remainder;
    }

    Ok(())
}
