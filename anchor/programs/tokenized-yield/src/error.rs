use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("invalid Share Amount")]
    InvalidShares,

    #[msg("Share Quantity Overflow")]
    Overflow,

    #[msg("Exceeds Total Supply")]
    ExceedsTotalSupply,
}
