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
}
