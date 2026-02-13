# Upgrade Policy

This document defines the upgrade authority policy for the Tokenized Yield Infrastructure protocol.

## Current Status

| Property | Value |
|----------|-------|
| Program ID | `HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j` |
| Upgradeable | Yes (by default in Anchor) |
| Upgrade Authority | Deployer wallet (development) |

## Upgrade Authority Holder

In development and testing environments, the **deployer wallet** holds upgrade authority.

For production deployment, one of the following actions **MUST** be taken:

### Option 1: Transfer to DAO (Recommended)

Transfer upgrade authority to a DAO-controlled multisig:

```bash
solana program set-upgrade-authority <PROGRAM_ID> \
  --new-upgrade-authority <DAO_MULTISIG_ADDRESS>
```

**Requirements:**
- Multisig should require M-of-N signatures (recommended: 3-of-5 minimum)
- Signers should be geographically distributed
- Time-lock on upgrades recommended (24-72 hours)

### Option 2: Burn Upgrade Authority (Maximum Security)

Permanently disable program upgrades:

```bash
solana program set-upgrade-authority <PROGRAM_ID> --final
```

**⚠️ WARNING:** This action is **IRREVERSIBLE**. The program can never be upgraded again.

**When to choose this option:**
- Protocol is considered feature-complete
- All audits have passed
- Bug bounty program has been running without critical findings
- Team accepts permanent immutability

### Option 3: Time-Locked Upgrade Authority

Use a program like Squads Protocol to:
- Require multiple signatures
- Enforce time-lock periods
- Enable on-chain governance voting

## Risks of Retaining Single-Signer Upgrade Authority

| Risk | Impact | Likelihood |
|------|--------|------------|
| Private key compromise | Attacker can replace program with malicious code | Medium |
| Accidental key loss | Program becomes unupgradeable unexpectedly | Low |
| Insider threat | Single operator can rug users | High for untrusted operators |
| Regulatory pressure | Single entity can be compelled to modify code | Medium |

## Recommended Production Deployment Checklist

- [ ] Complete all security audits
- [ ] Run bug bounty program for minimum 30 days
- [ ] Document all invariants (see PROTOCOL_INVARIANTS.md)
- [ ] Deploy to devnet and run extensive integration tests
- [ ] Deploy to mainnet with single-signer authority
- [ ] Monitor for 7-14 days with real usage
- [ ] Transfer upgrade authority to DAO multisig OR burn
- [ ] Announce final authority status to community

## Governance Authority vs Upgrade Authority

These are **separate** concepts:

| Aspect | Governance Authority | Upgrade Authority |
|--------|---------------------|-------------------|
| Controlled by | `vault.authority` field | Solana program metadata |
| Scope | Protocol parameters (fees, treasury) | Program bytecode |
| Revocable | Yes (`revoke_authority`) | Yes (burn authority) |
| Reversible | No (once revoked) | No (once burned) |

### Recommended Final State

For maximum security, a production protocol should:

1. **Burn upgrade authority** - Program code is immutable
2. **Revoke governance authority** - Protocol parameters are immutable

This creates a fully trustless, immutable protocol.

## Emergency Procedures

If upgrade authority has not been burned and a critical vulnerability is discovered:

1. **Pause protocol** (if pause functionality exists)
2. **Prepare patched program** and conduct rapid audit
3. **Deploy upgrade** via multisig or single signer
4. **Notify users** through all channels
5. **Post-mortem** and update security assumptions

## Version History

| Date | Action | Authority Holder |
|------|--------|-----------------|
| Initial | Deploy | Deployer wallet |
| TBD | Transfer to DAO | DAO Multisig |
| TBD | Burn (optional) | None (immutable) |
