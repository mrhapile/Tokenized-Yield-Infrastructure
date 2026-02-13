use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("invalid Share Amount")]
    InvalidShares,

    #[msg("Share Quantity Overflow")]
    Overflow,

    #[msg("Exceeds Total Supply")]
    ExceedsTotalSupply,

    #[msg("Math overflow occurred")]
    MathOverflow,

    #[msg("Invalid payment amount: does not match price per share")]
    InvalidPaymentAmount,

    #[msg("Share amount must be greater than zero")]
    InvalidShareAmount,

    #[msg("Invalid Payment Mint")]
    InvalidPaymentMint,

    #[msg("Invalid Token Account Owner")]
    InvalidTokenAccountOwner,

    #[msg("Invalid Payment Vault")]
    InvalidPaymentVault,

    #[msg("No shares minted")]
    NoSharesMinted,

    #[msg("Invalid revenue amount")]
    InvalidRevenueAmount,

    #[msg("Invalid shareholder account")]
    InvalidShareholder,

    #[msg("Arithmetic underflow")]
    Underflow,

    #[msg("Insufficient vault balance for reward")]
    InsufficientVaultBalance,

    #[msg("Insufficient shares for redemption")]
    InsufficientShares,

    // Performance Fee Layer Errors
    #[msg("Performance fee exceeds maximum of 20% (2000 bps)")]
    PerformanceFeeExceedsMax,

    #[msg("Invalid treasury account")]
    InvalidTreasury,
}
