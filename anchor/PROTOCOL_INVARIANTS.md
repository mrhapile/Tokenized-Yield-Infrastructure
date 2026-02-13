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

### Maximum Accumulator Growth Bound

The accumulator `acc_reward_per_share` grows monotonically. To prevent `u128` overflow:
$$
\text{Max Revenue} \approx \frac{u128::MAX}{\text{PRECISION}} \approx 3.4 \times 10^{26}
$$
Given reasonable token supplies (e.g., $10^9$), the accumulator will not overflow for eons. Explicit checks enforce this.

### Rounding Stability Guarantee & Remainder Conservation

Integer division introduces truncation errors (dust). To conserve these value leaks:

$$
\text{Remainder} = (\text{Amount} \times \text{PRECISION}) \pmod{\text{Minted Shares}}
$$

The protocol tracks `reward_remainder`. Once `reward_remainder >= minted_shares`, an additional unit is added to `acc_reward_per_share`.

$$
\text{Total Distributed} + \text{Remaining in Remainder} = \text{Total Revenue Exact}
$$


## 11. Redemption Conservation Invariant

When shares are redeemed, the total number of shares decreases exactly by the redeemed amount, and the user receives principal + pending rewards.

$$
\text{Vault.minted\_shares}_{new} = \text{Vault.minted\_shares}_{old} - \text{Amount}
$$

**Enforcement:**
- Atomic decrement of `vault.minted_shares` and `shareholder.quantity`.
- Checked subtraction prevents underflow.

## 12. No Phantom Share Invariant

A user cannot redeem more shares than they possess.

**Enforcement:**
- Explicit `require!(shareholder.quantity >= amount)`.
- Checked subtraction on `shareholder.quantity`.
- Token burn ensures on-chain SPL token supply matches program state.

## 13. Exit Fairness Invariant

A user redeeming shares must receive all pending rewards accrued up to the moment of redemption before their share balance is reduced.

**Enforcement:**
- `redeem_shares` calls the reward sync logic (identical to `harvest`) *before* modifying `quantity`.
- `reward_debt` is re-calculated based on the *new* lower quantity after redemption.

## 14. Capital Segregation Invariants

The protocol maintains strict separation between principal (user deposits) and revenue (protocol yield).

### Principal Solvency
$$ \text{principal\_vault.amount} \ge \text{minted\_shares} \times \text{price\_per\_share} $$

**Enforcement:**
- `mint_shares` deposits only to `principal_vault`.
- `redeem_shares` withdraws principal only from `principal_vault`.
- Checks against `InsufficientVaultBalance` ensure the principal remains untouched for other operations.

### Revenue Solvency
$$ \text{revenue\_vault.amount} \ge \sum(\text{unclaimed\_rewards}) $$

**Enforcement:**
- `deposit_revenue` deposits only to `revenue_vault`.
- `harvest` and `redeem_shares` (reward portion) withdraw only from `revenue_vault`.
- Prevents cross-contamination where rewards could theoretically be paid out of user principal if the yield logic failed.

---

## 15. Performance Fee Layer Invariants

The protocol implements a deterministic performance fee mechanism that extracts protocol revenue from deposited yield before shareholder distribution.

### 15.1 Protocol Revenue Invariant

The treasury balance must exactly equal the sum of all performance fees collected across all revenue deposits.

$$
\text{treasury\_balance} = \sum_{i}(\text{performance\_fee}_i) = \text{vault.total\_fees\_collected}
$$

**Enforcement:**
- Every `deposit_revenue` call computes `performance_fee = revenue * fee_bps / 10_000`.
- Performance fee is transferred to treasury PDA *before* distributable amount processing.
- `vault.total_fees_collected` is atomically incremented on each fee collection.
- Treasury PDA is validated against `vault.treasury` to prevent fund redirection.

### 15.2 Fee Boundedness Invariant

The performance fee basis points must never exceed the maximum allowed fee rate (20%).

$$
\text{performance\_fee\_bps} \le 2000
$$

**Enforcement:**
- `initialize_vault` explicitly validates `performance_fee_bps <= MAX_PERFORMANCE_FEE_BPS`.
- Constant `MAX_PERFORMANCE_FEE_BPS = 2000` is defined in vault state.
- `PerformanceFeeExceedsMax` error is thrown on violation.

### 15.3 Fee Decomposition Invariant

For every revenue deposit, the input amount must exactly decompose into performance fee and distributable amount with no loss.

$$
\text{revenue\_amount} = \text{performance\_fee} + \text{distributable\_amount}
$$

Where:
$$
\text{performance\_fee} = \lfloor \frac{\text{revenue} \times \text{fee\_bps}}{10000} \rfloor
$$
$$
\text{distributable\_amount} = \text{revenue} - \text{performance\_fee}
$$

**Enforcement:**
- Integer division truncation ensures deterministic fee calculation.
- Checked arithmetic prevents overflow/underflow.
- Distributable amount is computed via subtraction from original amount.

### 15.4 Accumulator Isolation Invariant

The reward accumulator `acc_reward_per_share` must only be updated using the distributable amount, never the gross revenue.

$$
\Delta \text{acc\_reward\_per\_share} = \frac{\text{distributable\_amount} \times \text{PRECISION}}{\text{minted\_shares}}
$$

**Enforcement:**
- Performance fee is transferred and deducted *before* accumulator math.
- Accumulator update code receives `distributable_amount` variable only.
- Existing precision math and remainder tracking are applied to net amount.

### 15.5 Zero Fee Passthrough Invariant

When `performance_fee_bps = 0`, the entire revenue amount must flow to shareholders.

$$
\text{if } \text{fee\_bps} = 0 \Rightarrow \text{distributable\_amount} = \text{revenue\_amount}
$$

**Enforcement:**
- Fee calculation correctly yields 0 when `fee_bps = 0`.
- Treasury transfer is skipped when `performance_fee = 0`.
- Full amount proceeds to revenue vault and accumulator update.

### Treasury PDA Definition

```
Seeds: [b"treasury", vault.key().as_ref()]
Authority: vault_signer PDA
Mint: payment_mint (same as principal/revenue vaults)
```

---

## 16. Governance Safety Invariants

The protocol implements a governance layer that allows controlled parameter updates while ensuring security through authority validation and optional permanent immutability.

### 16.1 Authority Exclusivity Invariant

Only the vault's designated authority may mutate governance-controlled parameters.

$$
\forall \text{ governance operations}: \text{caller} = \text{vault.authority}
$$

**Enforcement:**
- All governance instructions (`update_performance_fee`, `update_treasury`, `transfer_authority`, `revoke_authority`) require the `authority` signer.
- Account constraint: `authority.key() == vault.authority`.
- `Unauthorized` error thrown if constraint fails.

### 16.2 Fee Boundedness Under Governance Invariant

Performance fee updates must respect the same bounds as initialization.

$$
\text{new\_fee\_bps} \le \text{MAX\_PERFORMANCE\_FEE\_BPS} = 2000
$$

**Enforcement:**
- `update_performance_fee` validates `new_fee_bps <= 2000`.
- `PerformanceFeeExceedsMax` error on violation.
- Bound is enforced identically at initialization and update.

### 16.3 Governance Finality Invariant (Irreversible Revocation)

Once governance is revoked, it cannot be restored. The protocol becomes permanently immutable.

$$
\text{if } \text{vault.authority} = \text{Pubkey::default()} \Rightarrow \forall \text{ future governance calls fail}
$$

**Enforcement:**
- `revoke_authority` sets `vault.authority = Pubkey::default()`.
- All governance instructions check `!vault.is_governance_disabled()`.
- `GovernanceDisabled` error thrown after revocation.
- No instruction exists to restore authority from zero.

### 16.4 Authority Transfer Safety Invariant

Authority can only be transferred to valid, non-zero addresses.

$$
\text{new\_authority} \ne \text{Pubkey::default()}
$$

**Enforcement:**
- `transfer_authority` explicitly rejects zero address.
- `InvalidAuthority` error on violation.
- Intentional revocation requires explicit `revoke_authority` call.

### 16.5 Treasury Update Segregation Invariant

Treasury updates must maintain capital segregation by ensuring the new treasury:
1. Uses the same payment mint as the vault
2. Is owned by the vault's signer PDA

$$
\text{new\_treasury.mint} = \text{vault.payment\_mint}
$$
$$
\text{new\_treasury.owner} = \text{vault\_signer}
$$

**Enforcement:**
- `update_treasury` account constraints validate both conditions.
- `InvalidTreasury` error on violation.
- Prevents arbitrary fund redirection.

### 16.6 Governance State Transitions

Valid state transitions for `vault.authority`:

```
┌─────────────────┐    transfer_authority(X)    ┌─────────────────┐
│  Authority: A   │ ─────────────────────────► │  Authority: X   │
└─────────────────┘                             └─────────────────┘
        │                                               │
        │ revoke_authority()                            │ revoke_authority()
        ▼                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Authority: Pubkey::default()                       │
│              (GOVERNANCE PERMANENTLY DISABLED)                  │
│              No transitions possible from this state            │
└─────────────────────────────────────────────────────────────────┘
```



