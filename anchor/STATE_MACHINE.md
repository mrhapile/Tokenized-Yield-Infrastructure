# State Machine Formal Specification

This document formally specifies the valid states and transitions for the Tokenized Yield Vault protocol, including invariants that must hold across all execution paths.

## 1. System States

### State: Vault Initialized
- `vault.total_shares > 0`
- `vault.minted_shares == 0`
- `vault.acc_reward_per_share == 0`
- `vault.reward_remainder == 0`
- `reward_debt` for any un-initialized user == 0.

### State: Shares Active
- `0 < vault.minted_shares <= vault.total_shares`
- `sum(user.quantity) == vault.minted_shares`
- `payment_vault.balance >= vault.minted_shares * vault.price_per_share` (Principal Solvency)
- `acc_reward_per_share >= 0` (Monotonically non-decreasing)

### State: Revenue Deposited
- `payment_vault.balance > vault.minted_shares * vault.price_per_share` (Excess represents unclaimed rewards + remainder)
- `acc_reward_per_share` increased by `(amount * PRECISION) / minted_shares`.
- Implicit: `sum(pending_rewards) == total_revenue - total_claimed` (Reward Conservation)

### State: Shares Redeemed
- `vault.minted_shares` reduced by `amount`.
- `user.quantity` reduced by `amount`.
- `payment_vault.balance` reduced by `amount * price_per_share` (Principal withdrawal).
- `user.reward_debt` re-baselined to `new_quantity * acc_reward_per_share` (Exit Fairness)

## 2. Transitions

### Transition: `mint_shares(amount)`
- **Preconditions**:
  - `amount > 0`
  - `vault.minted_shares + amount <= vault.total_shares`
  - `payment_source_balance >= amount * price_per_share`
- **Postconditions**:
  - `vault.minted_shares += amount`
  - `user.quantity += amount`
  - `payment_vault.balance += amount * price_per_share`
  - `user.reward_debt` updated using `acc_reward_per_share` to account for new shares (starts at current accumulator).
- **Invariants Preserved**:
  - Valid Share Sum (`sum(quantity) == minted_shares`)
  - No Retroactive Reward Claiming (new shares have higher debt basis)

### Transition: `deposit_revenue(amount)`
- **Preconditions**:
  - `vault.minted_shares > 0`
  - `amount > 0`
- **Postconditions**:
  - `payment_vault.balance += amount`
  - `vault.acc_reward_per_share += (amount * PRECISION) / minted_shares`
  - `vault.reward_remainder += (amount * PRECISION) % minted_shares`
  - If remainder overflows, carry added to `acc_reward_per_share`.
- **Invariants Preserved**:
  - Reward Conservation (Total Deposited = Distributable + Remainder)
  - Accumulator Monotonicity

### Transition: `harvest()`
- **Preconditions**:
  - `user.quantity > 0` (or `pending > 0`)
  - `payment_vault.balance >= pending_reward`
- **Postconditions**:
  - `payment_vault.balance -= pending_reward`
  - `user.reward_debt` updated to `user.quantity * acc_reward_per_share / PRECISION`
  - `user.pending_reward == 0` (effectively)
- **Invariants Preserved**:
  - No Double Claim (debt prevents re-claiming)

### Transition: `redeem_shares(amount)`
- **Preconditions**:
  - `amount > 0`
  - `user.quantity >= amount`
  - `payment_vault.balance >= (amount * price_per_share) + pending_reward`
- **Postconditions**:
  - `vault.minted_shares -= amount`
  - `user.quantity -= amount`
  - `payment_vault.balance -= (amount * price_per_share)`
  - `payment_vault.balance -= pending_reward`
  - Share token supply reduced by `amount` (Burn).
  - `user.reward_debt` re-calculated for remaining quantity.
- **Invariants Preserved**:
  - Valid Share Sum
  - Principal Conservation
  - Exit Fairness

## 3. Formal Invariants

1. **Share Supply Integrity**:
   $$ \sum_{\forall i} \text{User}_i.\text{quantity} = \text{Vault.minted\_shares} $$

2. **Principal Solvency**:
   $$ \text{PaymentVault.balance} \ge \text{Vault.minted\_shares} \times \text{Vault.price\_per\_share} + \text{Pending Rewards} $$

3. **Reward Conservation**:
   $$ \text{Total Revenue Deposited} = \sum_{\forall i} \text{Claimed Rewards}_i + \sum_{\forall i} \text{Pending Rewards}_i + \frac{\text{Vault.reward\_remainder}}{\text{PRECISION}} $$

4. **Debt Integrity**:
   $$ \text{User}_i.\text{reward\_debt} \le \text{User}_i.\text{quantity} \times \text{Vault.acc\_reward\_per\_share} / \text{PRECISION} $$
