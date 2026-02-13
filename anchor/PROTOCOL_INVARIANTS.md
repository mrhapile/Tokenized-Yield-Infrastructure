# Protocol Invariants

This document defines the formal invariants enforced by the Tokenized Yield Infrastructure protocol. These invariants must hold true at the end of every instruction execution.

## 1. Supply Invariant

The number of minted shares must never exceed the total authorized shares for a vault.

$$
\text{vault.minted\_shares} \le \text{vault.total\_shares}
$$

**Enforcement:**
- Checked arithmetic during minting.
- Explicit `require!` check against `total_shares`.

## 2. Payment Integrity Invariant

The amount of payment tokens received by the payment vault must exactly match the number of shares minted multiplied by the price per share.

$$
\Delta \text{payment\_vault.amount} = \Delta \text{vault.minted\_shares} \times \text{vault.price\_per\_share}
$$

**Enforcement:**
- Payment amount is calculated internally on-chain: `amount * price_per_share`.
- Checked multiplication prevents overflow.
- CPI transfer uses the internally calculated amount.

## 3. Shareholder Conservation Invariant

The sum of all individual shareholder quantities must exactly equal the total minted shares recorded in the vault state.

$$
\sum_{i} \text{shareholder}_i.\text{quantity} = \text{vault.minted\_shares}
$$

**Enforcement:**
- Atomic updates: Vault state and UserStake state are updated in the same instruction.
- Same `amount` value used for both updates.

## 4. No Free Mint Invariant

No shares can be minted without a corresponding token transfer from the payer to the payment vault.

**Enforcement:**
- `mint_shares` instruction strictly enforces a token transfer CPI before minting shares.
- `amount > 0` check prevents zero-value transactions.

## 5. No Silent Overflow Invariant

All arithmetic operations regarding share quantities and payment amounts must use checked operations.

**Enforcement:**
- Usage of `checked_add`, `checked_mul` throughout the codebase.
- Explicit error handling (`ErrorCode::Overflow`, `ErrorCode::MathOverflow`) for all arithmetic steps.

## 6. Deterministic State Mutation Order

State mutations must occur in a deterministic order to prevent reentrancy side-effects, although the single-threaded Solana runtime mitigates this.

**Enforcement:**
1. Checks and calculations.
2. CPI interactions (Payment Transfer).
3. State mutations (Vault update, UserStake update).
