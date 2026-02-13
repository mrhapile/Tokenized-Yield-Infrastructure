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

## 7. Reward Conservation Invariant

The total rewards distributed to users plus the rewards remaining in the vault must equal the total revenue deposited into the payment vault (minus claimed rewards).

$$
\text{Total Deposited} = \sum \text{Claimed Rewards} + \text{Pending Rewards}
$$

**Enforcement:**
- `deposit_revenue` increases `acc_reward_per_share` based on `amount / total_shares`.
- `mint_shares` and `harvest` calculate pending rewards based on `acc_reward_per_share` delta.
- Checked arithmetic prevents loss of precision leaks (except unavoidable rounding).

## 8. No Double Claim Invariant

A user cannot claim the same reward twice.

**Enforcement:**
- `reward_debt` is updated atomically whenever `quantity` changes or `harvest` is called.
- `reward_debt` acts as a checkpoint: `pending = (quantity * acc_reward_per_share) - reward_debt`.

## 9. Proportional Distribution Invariant

Rewards are distributed strictly proportional to the number of shares held at the time of revenue deposit.

**Enforcement:**
- Global `acc_reward_per_share` accumulates rewards per unit of share.
- Individual user pending calculation `quantity * acc_reward_per_share` ensures proportionality.

## 10. Precision Stability Invariant

Calculations use sufficient precision to minimize dust loss, but safe arithmetic prevents overflow.

**Enforcement:**
- `PRECISION` constant (1e12) used for `acc_reward_per_share` scaling.
- Usage of `u128` for intermediate calculations.

