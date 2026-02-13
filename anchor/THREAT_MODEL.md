# Threat Model & Security Analysis

This document outlines the threat model for the Tokenized Yield Infrastructure protocol, analyzing potential attack vectors and the architectural mitigations in place.

## 1. Account Substitution Attacks

### Attack Vector
An attacker attempts to supply malicious accounts in place of legitimate program accounts to bypass checks or steal funds.

### Mitigations
- **Payment Vault Integrity**:
  - `deposit_revenue`, `harvest`, and `redeem_shares` implementation checks `payment_vault` ownership against `vault_signer` PDA.
  - Constraint: `constraint = payment_vault.owner == vault_signer.key()`.
- **Token Mint Verification**:
  - All token accounts (`payer_ata`, `payment_vault`, `user_ata`) are checked against `vault.payment_mint`.
  - Constraint: `constraint = token_account.mint == vault.payment_mint`.
- **PDA Mismatch**:
  - `vault_signer` is derived from `[b"vault_signer", vault.key()]`.
  - `shareholder` is derived from `[b"shareholder", vault.key(), user.key()]`.
  - Anchor's `seeds` and `bump` constraints automatically verify these derivations during account validation.
  - `vault` address is checked in `shareholder` account: `constraint = shareholder.vault == vault.key()`.

## 2. Arithmetic Attacks

### Attack Vector
An attacker provides extreme values to cause integer overflow/underflow, resulting in incorrect state updates (e.g., printing infinite shares or erasing debt).

### Mitigations
- **Checked Arithmetic**:
  - All mathematical operations (add, sub, mul, div, rem) use Rust's `checked_*` methods.
  - Any failure returns a specific error (e.g., `ErrorCode::Overflow`, `ErrorCode::MathOverflow`).
- **Precision Guards**:
  - `deposit_revenue` enforces `(amount * PRECISION)` does not overflow `u128`.
  - `vault.acc_reward_per_share` update enforces monotonicity: `new_acc >= old_acc`.
- **Underflow Protection**:
  - `redeem_shares` checks `shareholder.quantity >= amount` before subtraction.
  - `harvest` checks `accumulated >= reward_debt` (though logically guaranteed by non-decreasing accumulator).

## 3. Reward Manipulation Attacks

### Attack Vector
An attacker manipulates the timing or magnitude of deposits/withdrawals to game the reward distribution system.

### Mitigations
- **Mint Front-Running**:
  - If a user mints immediately before revenue deposit, they legitimately own shares at the time of distribution. This is intended behavior (pro-rata ownership).
  - Protocol Invariant: Rewards are distributed to shares existing at the exact moment of `deposit_revenue`.
- **Redeem After Revenue**:
  - A user redeeming after revenue distribution receives their pro-rata share of that revenue via the `harvest` logic embedded in `redeem_shares`.
- **Rapid Harvest Loops**:
  - `harvest` is idempotent.
  - `reward_debt` is updated to matches `accumulated` after every harvest.
  - Subsequent calls yield 0 pending rewards.
- **Remainder Gaming**:
  - `deposit_revenue` tracks `reward_remainder`.
  - Dust limits are strictly bounded by `minted_shares - 1` atomic units (scaled).
  - Accumulator only increases when `reward_remainder >= minted_shares`.

## 4. Share Inflation Attacks

### Attack Vector
An attacker attempts to mint more shares than authorized or without paying the principal.

### Mitigations
- **Total Supply Constraint**:
  - `mint_shares` adheres to `vault.total_shares` cap (if applicable) or logic limitations.
  - Currently, `minted_shares` is tracked.
- **Payment Integrity**:
  - `mint_shares` transfers `amount * price_per_share` to `payment_vault` before minting.
  - Uses `checked_mul` for cost calculation.
  - Token transfer is a CPI to the SPL Token program; failure in transfer reverts the transaction.

## 5. Vault Insolvency Attacks

### Attack Vector
An attacker attempts to drain the payment vault, leaving other users unable to claim rewards or redeem principal.

### Mitigations
- **Solvency Checks**:
  - `harvest` and `redeem_shares` explicitly check `payment_vault.amount >= required_amount` before attempting transfer.
  - Error: `ErrorCode::InsufficientVaultBalance`.
- **Conservation of Principal**:
  - Principal (mint cost) is locked in `payment_vault`.
  - `redeem_shares` only releases exactly `amount * price_per_share`.
- **State Integrity**:
  - `vault.acc_reward_per_share` only increases if revenue is actually deposited.
  - Revenue must be physically transferred to `payment_vault` in `deposit_revenue` for the accumulator to increment.

## 6. Ordering Attacks

### Attack Vector
An attacker exploits the order of operations within an instruction (reentrancy) or within a slot to create inconsistent state.

### Mitigations
- **CEI (Checks-Effects-Interactions) Pattern**:
  - All state mutations (`reward_debt`, `quantity`, `minted_shares`, `acc_reward_per_share`) occur **before** any CPI (Cross-Program Invocation) to transfer tokens.
  - If a CPI fails (e.g., frozen token account), the entire transaction reverts, rolling back state changes.
- **Atomicity**:
  - Solana transactions are atomic.
  - Multiple instructions in a slot are processed sequentially.
  - State updates in `mint_shares` typically include a harvest step to ensure `reward_debt` is fresh before quantity changes.

## Remaining Limitations
- **Precision Dust**:
  - Extremely small revenue deposits (1 token) distributed over extremely large share counts ($> 10^{12}$) may not increment `acc_reward_per_share` immediately.
  - Guaranteed by Remainder Conservation model to eventually distribute as remainder accumulates, bounded by `minted_shares`.
- **Token Decimals**:
  - Assumes standard SPL token behavior. Transfer-fee tokens would require extra logic to account for fees deducted during transfer (not currently supported).
