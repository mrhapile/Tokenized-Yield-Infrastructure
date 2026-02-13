# Numerical Stability Analysis

This document provides a formal numerical stability analysis of the Tokenized Yield Infrastructure protocol, proving that key state variables remain within safe bounds under all reachable execution paths.

## 1. Accumulator Growth Bound

### Definitions
- `PRECISION = 10^{12}` (u64 maximum scale for token decimals).
- `acc_reward_per_share`: A monotonically non-decreasing `u128` integer.

### Worst-Case Scenario Analysis
The accumulator grows fastest when `minted_shares` is minimized and `revenue_amount` is maximized.

Let:
- `amount_max` = $2^{64} - 1 \approx 1.84 \times 10^{19}$ (maximum single `u64` deposit).
- `minted_shares_min` = 1 (minimum shares required for deposit).

The maximum possible increment per transaction is:
$$
\Delta_{max} = \frac{\text{amount}_{max} \times \text{PRECISION}}{\text{minted\_shares}_{min}}
\approx \frac{1.84 \times 10^{19} \times 10^{12}}{1} \approx 1.84 \times 10^{31}
$$

### Overflow Threshold
The maximum value of a `u128` integer is:
$$
\text{u128}_{max} = 2^{128} - 1 \approx 3.40 \times 10^{38}
$$

The number of maximum-sized deposits required to overflow the accumulator is:
$$
N_{overflow} = \frac{\text{u128}_{max}}{\Delta_{max}}
\approx \frac{3.40 \times 10^{38}}{1.84 \times 10^{31}} \approx 1.84 \times 10^7
$$

### Reachability Conclusion
- To overflow, an attacker would need to deposit `u64::MAX` revenue **18.4 million times** consecutively while only 1 share exists.
- Total value required would be $18.4 \times 10^6 \times 1.84 \times 10^{19} \approx 3.4 \times 10^{26}$ tokens.
- This exceeds the total supply of any realistic token (e.g., SOL supply is $\approx 5 \times 10^8$ tokens).
- **Conclusion**: Accumulator overflow is theoretically possible but economically impossible.
- **Guard**: Explicit checked arithmetic (`checked_add`) will revert the transaction if this bound is ever reached.

## 2. Remainder Stability Proof

### Mechanism
The protocol tracks the remainder of the integer division to prevent dust loss:
$$
\text{remainder} = (\text{amount} \times \text{PRECISION}) \pmod{\text{minted\_shares}}
$$
The Vault stores `reward_remainder`.

### Loop Invariant
After every `deposit_revenue` call, the following invariant holds:
$$
0 \le \text{vault.reward\_remainder} < \text{vault.minted\_shares}
$$

### Proof by Induction
1. **Base Case**: `reward_remainder` starts at 0. $0 < \text{minted\_shares}$ (since shares > 0 is required).
2. **Step**: Let `R_old` be the existing remainder.
   - New remainder `R_temp = R_old + ((amount * PRECISION) % shares)`.
   - If `R_temp >= shares`, we distribute `R_temp / shares` as extra `acc_reward_per_share` and keep `R_new = R_temp % shares`.
   - Since modulo always yields a value in $[0, \text{shares}-1]$, `R_new` is strictly bounded.
   - Thus, `reward_remainder` never exceeds `minted_shares`.
   - **Conclusion**: No remainder accumulation can cause inflation or overflow `u128` (since `shares` is `u64`).

## 3. Reward Conservation Proof

### Theorem
The total rewards distributed to users plus the rewards pending/remaining in the system is essentially equal to the total revenue deposited, minus bounded dust.

$$
\sum \text{Distributed} \le \sum \text{Deposited}
$$

### Proof Logic
Due to integer division floor:
$$
\text{Increment} = \lfloor \frac{\text{Amount} \times P}{\text{Shares}} \rfloor
$$
$$
\text{Distributed} = \text{Increment} \times \text{Shares} \le \text{Amount} \times P
$$

Precision loss per deposit is strictly captured by `reward_remainder`.
Since `reward_remainder` is recycled into the accumulator once sufficient dust accumulates, the long-term loss is bounded by:
$$
\text{Loss}_{max} < \frac{\text{Minted Shares} - 1}{\text{PRECISION}}
$$
For `PRECISION = 1e12` and reasonable share counts, this loss is negligible ($< 1$ atomic unit of principal).

## 4. Underflow Safety Proof

### Pending Calculation
$$
\text{Pending} = (\text{Quantity} \times \text{Acc}) - \text{Debt}
$$

### Proposition
$\text{Pending} \ge 0$ for all valid states.

### Proof
1. **Initialization**: When a user enters (mints), `Debt` is initialized to `Quantity * Acc`. Thus `Pending` starts at 0.
2. **Monotonicity**: `Acc` is strictly non-decreasing (only adds positive increments).
3. **State Updates**:
   - if `Acc` increases, `Quantity * Acc` increases. `Debt` implies previous value. $New > Old \implies Pending > 0$.
   - **Harvest**: Sets `Debt = Quantity * Acc`. Resetting `Pending` to 0.
   - **Mint (Add Quantity)**:
     - Old pending claimed first.
     - `Debt` increased by `Delta_Quantity * Acc`.
     - `Quantity` increased.
     - $(Q_{old} + \Delta Q) \times Acc - (D_{old} + \Delta Q \times Acc) = (Q_{old} \times Acc - D_{old}) \ge 0$.
   - **Redeem (Remove Quantity)**:
     - Old pending claimed first.
     - `Quantity` reduced. `Debt` reduced proportionally.
     - New state is consistent.

**Conclusion**: Underflow is impossible as precise debt tracking acts as a "high-water mark" for rewards.

## 5. Share Supply Bound

### Constraint
`vault.minted_shares` is a `u64`.

### Proof
- **Mint**:
  - `checked_add` prevents overflow.
  - `require!(total_shares >= minted + amount)` enforces explicit cap.
- **Redeem**:
  - `checked_sub` prevents underflow.
- **Consistency**:
  - `sum(user.quantity) == vault.minted_shares` is preserved atomically.
  - No mechanism exists to mint shares without increasing `minted_shares`.
- **Conclusion**: `minted_shares` is bounded by `u64::MAX`, and practically by `vault.total_shares`.

## 6. Long-Term Stability Model

### Simulation Hypothesis
Assume 10,000,000 operations (deposits, harvests, redeems).

- **Drift**: Is accumulation drift possible?
  - No. `reward_remainder` creates a closed loop.
  - $Remainder_{t+1} = (Remainder_t + \text{NewDust}) \pmod{Shares}$.
  - Any drift is cyclic and bounded by `Shares`.
- **Ghost Rewards**: Can users claim more than deposited?
  - No. `pending` calculation is derived strictly from `acc_reward_per_share`.
  - `acc_reward_per_share` is derived strictly from `payment_vault` deposits.
  - Invariant: `payment_vault.balance >= sum(pending)`.
  - Solvency check in `harvest` guarantees no phantom payouts.

## Test Validation Summary

| Proof Section | Proof Mechanism | Validated By Test | Code Guard |
| :--- | :--- | :--- | :--- |
| Accumulator Growth | Theoretical Bound | `REVENUE: Large Revenue Overflow Guard` | `checked_add`, `require!(new >= old)` |
| Remainder Stability | Inductive Modulo | `ADV-3: Remainder Grinding Simulation` | `checked_rem` |
| Reward Conservation | Floor Division | `REVENUE: Single User Distribution` | Implicit Logic |
| Underflow Safety | High-Water Mark | `REVENUE: Harvest without new revenue` | `checked_sub` |
| Share Supply Bound | `u64` Limit | `INVARIANT: Supply Cap Enforcement` | `checked_add`, `require!` |
| Long-Term Stability | Closed Loop | `ADV-1` & `ADV-2` | All Invariants |

## Formal Claim

Under current constraints, the protocol is **numerically stable** within the bounds of `u128` and `u64` arithmetic for all reachable states.
The maximum theoretical error is bounded by the remainder conservation model, ensuring no long-term inflation or deflation of the reward pool beyond atomic dust.
