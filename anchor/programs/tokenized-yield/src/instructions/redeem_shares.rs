use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, Burn, transfer, burn};
use crate::{UserStake, Vault, error::ErrorCode, constants::PRECISION};

#[derive(Accounts)]
pub struct RedeemShares<'info> {
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
        constraint = shareholder.vault == vault.key() @ ErrorCode::InvalidShareholder,
        seeds= [b"shareholder", vault.key().as_ref(), payer.key().as_ref()],
        bump = shareholder.bump
    )]
    pub shareholder: Account<'info, UserStake>,

    #[account(
        mut,
        constraint = principal_vault.key() == vault.principal_vault @ ErrorCode::InvalidPaymentVault,
        constraint = principal_vault.owner == vault_signer.key() @ ErrorCode::InvalidPaymentVault
    )]
    pub principal_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = revenue_vault.key() == vault.revenue_vault @ ErrorCode::InvalidPaymentVault,
        constraint = revenue_vault.owner == vault_signer.key() @ ErrorCode::InvalidPaymentVault
    )]
    pub revenue_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = investor_share_ata.mint == vault.vault_share_mint @ ErrorCode::InvalidPaymentMint,
        constraint = investor_share_ata.owner == payer.key() @ ErrorCode::InvalidTokenAccountOwner
    )]
    pub investor_share_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_share_mint", vault.key().as_ref()],
        bump
    )]
    pub vault_share_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = payer_ata.mint == vault.payment_mint @ ErrorCode::InvalidPaymentMint,
        constraint = payer_ata.owner == payer.key() @ ErrorCode::InvalidTokenAccountOwner
    )]
    pub payer_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn process_redeem_shares(ctx: Context<RedeemShares>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let shareholder = &mut ctx.accounts.shareholder;
    let principal_vault = &mut ctx.accounts.principal_vault;
    let revenue_vault = &mut ctx.accounts.revenue_vault;
    let token_program = &ctx.accounts.token_program;
    let vault_signer = &ctx.accounts.vault_signer;

    require!(amount > 0, ErrorCode::InvalidShareAmount);
    require!(shareholder.quantity >= amount, ErrorCode::InsufficientShares);

    // STEP A: REWARD SYNC
    // Compute pending reward for EXISTING quantity
    let accumulated = (shareholder.quantity as u128)
        .checked_mul(vault.acc_reward_per_share)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    let pending = accumulated
        .checked_sub(shareholder.reward_debt)
        .ok_or(ErrorCode::Underflow)?;

    let vault_key = vault.key();
    let seeds = &[b"vault_signer".as_ref(), vault_key.as_ref(), &[vault.signer_bump]];
    let signer = &[&seeds[..]];

    if pending > 0 {
        let pending_u64 = u64::try_from(pending).map_err(|_| ErrorCode::Overflow)?;

        require!(
            revenue_vault.amount >= pending_u64,
            ErrorCode::InsufficientVaultBalance
        );

        // Update checkpoint before transfer
        shareholder.reward_debt = accumulated;

        let cpi_accounts_reward = Transfer {
            from: revenue_vault.to_account_info(),
            to: ctx.accounts.payer_ata.to_account_info(), // Send reward to payer
            authority: vault_signer.to_account_info(),
        };
        let cpi_ctx_reward = CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts_reward, signer);
        transfer(cpi_ctx_reward, pending_u64)?;
    } else {
        shareholder.reward_debt = accumulated;
    }

    // STEP B: PRINCIPAL CALCULATION
    let principal = amount
        .checked_mul(vault.price_per_share)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        principal_vault.amount >= principal,
        ErrorCode::InsufficientVaultBalance
    );

    // STEP C: STATE UPDATE (CEI)
    let new_quantity = shareholder.quantity
        .checked_sub(amount)
        .ok_or(ErrorCode::Underflow)?;
    
    let new_minted_shares = vault.minted_shares
        .checked_sub(amount)
        .ok_or(ErrorCode::Underflow)?;

    shareholder.quantity = new_quantity;
    vault.minted_shares = new_minted_shares;

    // Recompute reward debt for NEW quantity
    // Debt = new_quantity * acc_reward_per_share / PRECISION
    shareholder.reward_debt = (new_quantity as u128)
        .checked_mul(vault.acc_reward_per_share)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    // STEP D: CPI OPERATIONS
    
    // 1. Burn shares
    let cpi_accounts_burn = Burn {
        mint: ctx.accounts.vault_share_mint.to_account_info(),
        from: ctx.accounts.investor_share_ata.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_ctx_burn = CpiContext::new(token_program.to_account_info(), cpi_accounts_burn);
    burn(cpi_ctx_burn, amount)?;

    // 2. Transfer principal
    let cpi_accounts_principal = Transfer {
        from: principal_vault.to_account_info(),
        to: ctx.accounts.payer_ata.to_account_info(),
        authority: vault_signer.to_account_info(),
    };
    let cpi_ctx_principal = CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts_principal, signer);
    transfer(cpi_ctx_principal, principal)?;

    Ok(())
}
