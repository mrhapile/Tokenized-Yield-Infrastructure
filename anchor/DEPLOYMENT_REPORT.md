# Deployment Report

## Protocol Status: ⏳ PENDING DEPLOYMENT

Generated: [PENDING]

---

## Deployment Instructions

### Prerequisites

1. **Solana CLI configured for devnet:**
   ```bash
   solana config set --url devnet
   ```

2. **Wallet with devnet SOL:**
   ```bash
   solana balance
   # If low, request airdrop:
   solana airdrop 2
   ```

3. **Anchor CLI installed:**
   ```bash
   anchor --version
   # Should show 0.31.x
   ```

### Step 1: Build the Program

```bash
cd anchor
anchor build
```

This will:
- Compile the Rust program
- Generate the IDL at `target/idl/tokenized_yield_infrastructure.json`
- Create the program binary at `target/deploy/`

### Step 2: Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

Expected output:
```
Deploying workspace: https://api.devnet.solana.com
Upgrade authority: <YOUR_WALLET>
Deploying program "tokenized_yield_infrastructure"...
Program Id: HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j
```

### Step 3: Initialize Vault & Execute Governance Flow

Run the deployment script:

```bash
npx ts-node scripts/devnet-deploy.ts
```

This script will:
1. ✅ Initialize a new vault (if not exists)
2. ✅ Update performance fee to 10%
3. ✅ Transfer authority (test round-trip)
4. ✅ Revoke authority permanently
5. ✅ Verify all governance calls fail post-revocation
6. ✅ Generate this deployment report

---

## Verification Checklist

After deployment, verify on Solana Explorer:

- [ ] Program deployed at correct address
- [ ] Vault PDA created with correct seeds
- [ ] Authority field shows `11111111111111111111111111111111` (revoked)
- [ ] Treasury PDA created and isolated
- [ ] All governance transactions confirmed

---

## Post-Deployment

Once deployed, the following properties are **PERMANENT**:

| Property | Value | Can Change? |
|----------|-------|-------------|
| Program Code | Deployed binary | Yes (upgrade authority) |
| Fee Parameters | Set at revocation | **NO** |
| Treasury Address | PDA from vault | **NO** |
| Governance | Revoked | **NO** |

---

## Explorer Links

- **Program:** [View on Explorer](https://explorer.solana.com/address/HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j?cluster=devnet)
- **Vault:** [To be updated after deployment]
- **Treasury:** [To be updated after deployment]

---

## Security Notes

1. **Upgrade Authority**: The program upgrade authority is retained for security patches. See [UPGRADE_POLICY.md](./UPGRADE_POLICY.md) for the governance process.

2. **Immutability**: Once `revoke_authority` is called, the protocol parameters are permanently frozen. This is intentional and cannot be reversed.

3. **Treasury**: The treasury PDA is owned by the program and isolated from user funds. Protocol fees accumulate here and can only be withdrawn through designated (not yet implemented) withdrawal mechanisms.

---

*This report will be auto-updated by `scripts/devnet-deploy.ts` after successful deployment.*
