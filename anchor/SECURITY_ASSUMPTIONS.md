# Security Assumptions

This document defines the trust model and security assumptions for the Tokenized Yield Infrastructure protocol.

## Trust Model

### Trusted Components

| Component | Trust Assumption | Justification |
|-----------|-----------------|---------------|
| Solana Runtime | Correct execution | Foundation of all Solana programs |
| SPL Token Program | Correct token operations | Battle-tested, audited, widely used |
| Anchor Framework | Correct account validation | Industry standard, audited |
| System Program | Correct lamport operations | Core Solana primitive |

### Semi-Trusted Components

| Component | Trust Assumption | Risk Mitigation |
|-----------|-----------------|-----------------|
| Vault Authority | Will not maliciously update parameters | Can be revoked; max fee bounded |
| Upgrade Authority | Will not deploy malicious code | Can be transferred to DAO or burned |
| Revenue Depositors | Deposits are legitimate yield | No protocol-level verification possible |

### Untrusted Components

| Component | Assumption | Defense |
|-----------|------------|---------|
| External Users | May attempt exploitation | All invariants enforced on-chain |
| Front-end | May be compromised | All validation in smart contract |
| RPC Nodes | May return stale data | Users should verify on-chain state |

## Authority Assumptions

### Governance Authority (`vault.authority`)

**Capabilities:**
- Update performance fee (0-20%)
- Update treasury account (within constraints)
- Transfer authority to another address
- Permanently revoke all governance

**Constraints:**
- Cannot exceed 20% fee
- Cannot redirect treasury to arbitrary accounts
- Cannot modify core economic logic
- Cannot access user funds directly

**Risk Assessment:**
- If compromised: Attacker can set max fees (20%)
- Mitigation: Fee bounded; can revoke authority

### Program Upgrade Authority

**Capabilities:**
- Replace entire program bytecode
- Modify any logic, including fund access

**Constraints:**
- None (can do anything)

**Risk Assessment:**
- If compromised: Total fund loss possible
- Mitigation: Transfer to DAO or burn

## Capital Segregation Guarantees

The protocol maintains strict separation between three capital pools:

### 1. Principal Vault
- **Contains:** User deposits (shares × price_per_share)
- **Access:** Only via `redeem_shares`
- **Guarantee:** Principal can only flow to share redeemers

### 2. Revenue Vault
- **Contains:** Distributable yield (after fees)
- **Access:** Only via `harvest` or reward portion of `redeem_shares`
- **Guarantee:** Revenue can only flow to shareholders proportionally

### 3. Treasury
- **Contains:** Protocol performance fees
- **Access:** None (accumulates only)
- **Guarantee:** Fees cannot be redirected to shareholders

### Cross-Contamination Prevention

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Principal      │     │  Revenue        │     │  Treasury       │
│  Vault          │     │  Vault          │     │                 │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ IN:  mint_shares│     │ IN:  deposit_rev│     │ IN:  deposit_rev│
│ OUT: redeem     │     │ OUT: harvest    │     │ OUT: (none)     │
│      (principal)│     │      redeem     │     │                 │
│                 │     │      (rewards)  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                    No cross-transfers allowed
```

## Solvency Requirements

### Principal Solvency

At all times:
$$\text{principal\_vault.amount} \ge \text{minted\_shares} \times \text{price\_per\_share}$$

**Enforcement:**
- Deposits exactly match share price
- Redemptions are checked against vault balance
- No partial fulfillment

### Revenue Solvency

At all times:
$$\text{revenue\_vault.amount} \ge \sum(\text{pending\_rewards})$$

**Enforcement:**
- Revenue deposited before accumulator update
- Harvest amounts calculated from accumulator
- Checked transfer prevents overdraw

### Treasury Solvency

$$\text{treasury.amount} = \text{vault.total\_fees\_collected}$$

**Enforcement:**
- Atomic increment of counter and transfer
- No withdrawal mechanism exists

## External Token Trust

### SPL Token Integrity Assumptions

1. **Token Program Correctness**
   - `transfer` moves exact amounts
   - `mint_to` creates exact supply
   - `burn` destroys exact amounts

2. **Mint Authority**
   - Payment mint: Arbitrary (user's choice)
   - Share mint: Controlled by vault_signer PDA

3. **Freeze Authority**
   - Payment mint: May exist (user's risk)
   - Share mint: Controlled by vault_signer PDA

### Token-Related Risks

| Risk | Impact | Protocol Response |
|------|--------|-------------------|
| Payment token freeze | Users cannot deposit/withdraw | No mitigation possible |
| Payment token inflation | Dilutes vault value | No mitigation possible |
| Malicious token | Reentrancy, callbacks | Solana's execution model prevents |

## Arithmetic Safety

### Overflow Protection

All arithmetic uses checked operations:
- `checked_add`, `checked_sub`, `checked_mul`, `checked_div`
- Explicit error codes for each failure mode

### Precision Handling

- Accumulator uses `u128` with `PRECISION = 10^12`
- Remainder tracking prevents dust accumulation
- Integer division truncates (floor)

### Safe Bounds

| Variable | Type | Max Safe Value |
|----------|------|---------------|
| shares | u64 | 10^19 |
| prices | u64 | 10^19 |
| revenue | u64 | 10^19 |
| accumulator | u128 | 10^38 |

## Attack Surface Analysis

### Addressed Attack Vectors

| Attack | Defense |
|--------|---------|
| Reentrancy | Solana's single-threaded execution |
| Front-running | Accepted; rewards snapshot at entry |
| Integer overflow | Checked arithmetic |
| Unauthorized access | PDA constraints, signer checks |
| Double-claim | reward_debt tracking |

### Out-of-Scope Attacks

| Attack | Reason |
|--------|--------|
| Key compromise | User responsibility |
| Social engineering | Off-chain |
| RPC manipulation | Client responsibility |
| Validator collusion | Solana assumption |

## Assumptions Summary

For this protocol to be secure, the following must hold:

1. ✅ Solana runtime executes correctly
2. ✅ SPL Token program is not compromised
3. ✅ Anchor framework validates accounts correctly
4. ⚠️ Upgrade authority is trusted OR burned
5. ⚠️ Governance authority is trusted OR revoked
6. ℹ️ Payment token is not maliciously frozen/inflated
7. ℹ️ Users verify transactions before signing

**Legend:**
- ✅ Reasonable assumption (widely accepted)
- ⚠️ Controllable risk (can be eliminated)
- ℹ️ User responsibility
