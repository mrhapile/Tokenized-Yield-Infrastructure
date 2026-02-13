use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer, transfer},
};

pub use crate::UserStake;
use crate::{error::ErrorCode, Vault};

#[derive(Accounts)]
pub struct MintShares<'info> {
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

    // we deduct money from here.
    #[account(
        mut,
        constraint = payer_ata.mint == vault.payment_mint @ ErrorCode::InvalidPaymentMint,
        constraint = payer_ata.owner == payer.key() @ ErrorCode::InvalidTokenAccountOwner
    )]
    pub payer_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = payment_vault.mint == vault.payment_mint @ ErrorCode::InvalidPaymentMint,
        constraint = payment_vault.owner == vault_signer.key() @ ErrorCode::InvalidPaymentVault
    )]
    pub payment_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_share_mint", vault.key().as_ref()],
        bump
    )]
    pub vault_share_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = vault_share_mint,
        associated_token::authority = payer,
    )]
    pub investor_share_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        seeds= [b"shareholder", vault.key().as_ref(), payer.key().as_ref()],
        bump,
        space= 8 + UserStake::INIT_SPACE
    )]
    pub shareholder: Account<'info, UserStake>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn process_mint_shares(ctx: Context<MintShares>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let shareholder = &mut ctx.accounts.shareholder;

    require!(amount > 0, ErrorCode::InvalidShareAmount);

    // 1. Calculate new vault state
    let new_minted = vault
        .minted_shares
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    
    // Redundant safety check
    require!(
        new_minted <= vault.total_shares,
        ErrorCode::ExceedsTotalSupply
    );

    // Calculate expected payment
    let expected_payment = amount
        .checked_mul(vault.price_per_share)
        .ok_or(ErrorCode::MathOverflow)?;

    // 2. Calculate new shareholder state
    if shareholder.is_initialized == false {
        shareholder.is_initialized = true;
        shareholder.owner = *ctx.accounts.payer.key;
        shareholder.vault = vault.key();
        shareholder.quantity = 0u64;
        shareholder.reward_debt = 0u128;
        shareholder.bump = ctx.bumps.shareholder;
    }

    // Compute pending reward for existing shares (if any)
    let pending = if shareholder.quantity > 0 {
        let accumulated = (shareholder.quantity as u128)
            .checked_mul(vault.acc_reward_per_share)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(crate::constants::PRECISION)
            .ok_or(ErrorCode::MathOverflow)?;

        accumulated
            .checked_sub(shareholder.reward_debt)
            .ok_or(ErrorCode::Underflow)?
    } else {
        0
    };

    let new_quantity = shareholder.quantity
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    // 3. Mutate State (Effects)
    vault.minted_shares = new_minted;
    shareholder.quantity = new_quantity;
    
    // Update reward debt based on new quantity
    shareholder.reward_debt = (shareholder.quantity as u128)
        .checked_mul(vault.acc_reward_per_share)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(crate::constants::PRECISION)
        .ok_or(ErrorCode::MathOverflow)?;

    // 4. Perform CPIs (Interactions)
    
    // Transfer pending rewards if any
    if pending > 0 {
        let pending_u64 = u64::try_from(pending).map_err(|_| ErrorCode::Overflow)?;
        
        let vault_key = vault.key();
        let seeds = &[b"vault_signer".as_ref(), vault_key.as_ref(), &[vault.signer_bump]];
        let signer = &[&seeds[..]];

        // We transfer form payment_vault to payer_ata (user's wallet)
        // Reusing accounts already passed. 
        // payment_vault is source (owned by vault_signer)
        // payer_ata is dest (owned by payer)
        let cpi_accounts_reward = Transfer {
            from: ctx.accounts.payment_vault.to_account_info(),
            to: ctx.accounts.payer_ata.to_account_info(),
            authority: ctx.accounts.vault_signer.to_account_info(),
        };
        let cpi_program_token = ctx.accounts.token_program.to_account_info();
        transfer(CpiContext::new_with_signer(cpi_program_token, cpi_accounts_reward, signer), pending_u64)?;
    }
    
    // Transfer payment to vault
    let cpi_accounts_transfer = Transfer {
        from: ctx.accounts.payer_ata.to_account_info(),
        to: ctx.accounts.payment_vault.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_program_token = ctx.accounts.token_program.to_account_info();
    transfer(CpiContext::new(cpi_program_token, cpi_accounts_transfer), expected_payment)?;

    // Mint shares to user
    let vault_key = vault.key();
    let seeds = &[b"vault_signer".as_ref(), vault_key.as_ref(), &[vault.signer_bump]];
    let signer = &[&seeds[..]];

    let cpi_accounts_mint = MintTo {
        mint: ctx.accounts.vault_share_mint.to_account_info(),
        to: ctx.accounts.investor_share_ata.to_account_info(),
        authority: ctx.accounts.vault_signer.to_account_info(),
    };
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts_mint,
            signer,
        ),
        amount,
    )?;

    Ok(())
}
