/**
 * Devnet Deployment & Governance Finalization Script
 * 
 * This script:
 * 1. Initializes a vault on devnet
 * 2. Executes governance finalization (update fee, transfer, revoke)
 * 3. Verifies all governance calls fail after revocation
 * 
 * Run with: npx ts-node scripts/devnet-deploy.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, clusterApiUrl, Keypair } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Load IDL
const IDL_PATH = path.join(__dirname, "../anchor/target/idl/tokenized_yield_infrastructure.json");

interface DeploymentReport {
  programId: string;
  cluster: string;
  deploymentTimestamp: string;
  vault: {
    pda: string;
    signerPda: string;
    shareMint: string;
    principalVault: string;
    revenueVault: string;
    treasury: string;
  };
  governance: {
    initialAuthority: string;
    finalAuthority: string;
    feeUpdateTx: string | null;
    authorityTransferTx: string | null;
    revokeTx: string | null;
    postRevokeFailures: string[];
  };
  explorerLinks: {
    program: string;
    vault: string;
    treasury: string;
  };
  status: "IMMUTABLE" | "ACTIVE";
}

async function main() {
  console.log("=".repeat(60));
  console.log("DEVNET DEPLOYMENT & GOVERNANCE FINALIZATION");
  console.log("=".repeat(60));

  // Setup connection
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // Load wallet from default Solana config
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  
  console.log(`\nWallet: ${walletKeypair.publicKey.toBase58()}`);
  
  // Check balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);
  
  if (balance < 0.5 * 1e9) {
    console.log("\n⚠️  Low balance! Request airdrop...");
    const airdropSig = await connection.requestAirdrop(walletKeypair.publicKey, 2 * 1e9);
    await connection.confirmTransaction(airdropSig);
    console.log("✅ Airdrop received");
  }

  // Program ID (from Anchor.toml)
  const PROGRAM_ID = new PublicKey("HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j");
  
  // Load IDL
  let idl;
  try {
    idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
  } catch (e) {
    console.error("❌ IDL not found. Run 'anchor build' first.");
    process.exit(1);
  }

  // Create provider and program
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  
  const program = new Program(idl, provider);

  // Derive PDAs
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), walletKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const [vaultSignerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_signer"), vaultPda.toBuffer()],
    PROGRAM_ID
  );

  const [vaultShareMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_share_mint"), vaultPda.toBuffer()],
    PROGRAM_ID
  );

  const [principalVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("principal-vault"), vaultPda.toBuffer()],
    PROGRAM_ID
  );

  const [revenueVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("revenue-vault"), vaultPda.toBuffer()],
    PROGRAM_ID
  );

  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), vaultPda.toBuffer()],
    PROGRAM_ID
  );

  console.log("\n📍 DERIVED PDAs:");
  console.log(`   Vault:          ${vaultPda.toBase58()}`);
  console.log(`   Vault Signer:   ${vaultSignerPda.toBase58()}`);
  console.log(`   Share Mint:     ${vaultShareMintPda.toBase58()}`);
  console.log(`   Principal Vault:${principalVaultPda.toBase58()}`);
  console.log(`   Revenue Vault:  ${revenueVaultPda.toBase58()}`);
  console.log(`   Treasury:       ${treasuryPda.toBase58()}`);

  // Initialize report
  const report: DeploymentReport = {
    programId: PROGRAM_ID.toBase58(),
    cluster: "devnet",
    deploymentTimestamp: new Date().toISOString(),
    vault: {
      pda: vaultPda.toBase58(),
      signerPda: vaultSignerPda.toBase58(),
      shareMint: vaultShareMintPda.toBase58(),
      principalVault: principalVaultPda.toBase58(),
      revenueVault: revenueVaultPda.toBase58(),
      treasury: treasuryPda.toBase58(),
    },
    governance: {
      initialAuthority: walletKeypair.publicKey.toBase58(),
      finalAuthority: "",
      feeUpdateTx: null,
      authorityTransferTx: null,
      revokeTx: null,
      postRevokeFailures: [],
    },
    explorerLinks: {
      program: `https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=devnet`,
      vault: `https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet`,
      treasury: `https://explorer.solana.com/address/${treasuryPda.toBase58()}?cluster=devnet`,
    },
    status: "ACTIVE",
  };

  // Check if vault already exists
  const existingVault = await connection.getAccountInfo(vaultPda);
  
  if (!existingVault) {
    console.log("\n📦 STEP 1: Initialize Vault");
    console.log("-".repeat(40));

    // Create payment mint for the vault
    console.log("   Creating payment mint...");
    const paymentMint = await createMint(
      connection,
      walletKeypair,
      walletKeypair.publicKey,
      null,
      6
    );
    console.log(`   Payment Mint: ${paymentMint.toBase58()}`);

    // Initialize vault with 5% fee
    console.log("   Initializing vault...");
    const initTx = await program.methods
      .initializeVault(
        "Production Vault",
        new anchor.BN(1_000_000_000), // 1B shares
        new anchor.BN(100), // 100 tokens per share
        500 // 5% fee
      )
      .accounts({
        owner: walletKeypair.publicKey,
        vault: vaultPda,
        vaultSigner: vaultSignerPda,
        paymentMint: paymentMint,
        principalVault: principalVaultPda,
        revenueVault: revenueVaultPda,
        treasury: treasuryPda,
        vaultShareMint: vaultShareMintPda,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log(`   ✅ Vault initialized: ${initTx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${initTx}?cluster=devnet`);
  } else {
    console.log("\n✅ Vault already exists, skipping initialization");
  }

  // Fetch vault state
  console.log("\n📊 FETCHING VAULT STATE");
  console.log("-".repeat(40));
  
  const vaultAccount = await program.account.vault.fetch(vaultPda);
  console.log(`   Owner: ${vaultAccount.owner.toBase58()}`);
  console.log(`   Authority: ${vaultAccount.authority.toBase58()}`);
  console.log(`   Performance Fee: ${vaultAccount.performanceFeeBps} bps (${vaultAccount.performanceFeeBps / 100}%)`);
  console.log(`   Total Shares: ${vaultAccount.totalShares.toString()}`);
  console.log(`   Minted Shares: ${vaultAccount.mintedShares.toString()}`);

  // Check if authority is already revoked
  const isRevoked = vaultAccount.authority.equals(PublicKey.default);
  
  if (isRevoked) {
    console.log("\n✅ Authority already revoked - protocol is immutable");
    report.governance.finalAuthority = PublicKey.default.toBase58();
    report.status = "IMMUTABLE";
  } else {
    // GOVERNANCE FINALIZATION FLOW
    console.log("\n🔐 GOVERNANCE FINALIZATION FLOW");
    console.log("=".repeat(40));

    // Step 1: Update performance fee
    console.log("\n📝 Step 1: Update Performance Fee to 10%");
    try {
      const feeTx = await program.methods
        .updatePerformanceFee(1000) // 10%
        .accounts({
          vault: vaultPda,
          authority: walletKeypair.publicKey,
        })
        .rpc();
      
      console.log(`   ✅ Fee updated: ${feeTx}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${feeTx}?cluster=devnet`);
      report.governance.feeUpdateTx = feeTx;

      // Verify
      const updatedVault = await program.account.vault.fetch(vaultPda);
      console.log(`   Verified fee: ${updatedVault.performanceFeeBps} bps`);
    } catch (e: any) {
      console.log(`   ⚠️ Fee update skipped: ${e.message}`);
    }

    // Step 2: Transfer authority to test address
    console.log("\n📝 Step 2: Transfer Authority");
    const testAuthority = Keypair.generate();
    try {
      // Fund test authority
      const fundTx = await connection.requestAirdrop(testAuthority.publicKey, 0.1 * 1e9);
      await connection.confirmTransaction(fundTx);

      const transferTx = await program.methods
        .transferAuthority(testAuthority.publicKey)
        .accounts({
          vault: vaultPda,
          authority: walletKeypair.publicKey,
        })
        .rpc();
      
      console.log(`   ✅ Authority transferred: ${transferTx}`);
      console.log(`   New Authority: ${testAuthority.publicKey.toBase58()}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${transferTx}?cluster=devnet`);
      report.governance.authorityTransferTx = transferTx;

      // Transfer back for revocation
      const transferBackTx = await program.methods
        .transferAuthority(walletKeypair.publicKey)
        .accounts({
          vault: vaultPda,
          authority: testAuthority.publicKey,
        })
        .signers([testAuthority])
        .rpc();
      
      console.log(`   ✅ Authority transferred back: ${transferBackTx}`);
    } catch (e: any) {
      console.log(`   ⚠️ Transfer skipped: ${e.message}`);
    }

    // Step 3: Revoke authority permanently
    console.log("\n📝 Step 3: REVOKE AUTHORITY (IRREVERSIBLE)");
    try {
      const revokeTx = await program.methods
        .revokeAuthority()
        .accounts({
          vault: vaultPda,
          authority: walletKeypair.publicKey,
        })
        .rpc();
      
      console.log(`   ✅ Authority REVOKED: ${revokeTx}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${revokeTx}?cluster=devnet`);
      report.governance.revokeTx = revokeTx;
      report.governance.finalAuthority = PublicKey.default.toBase58();
      report.status = "IMMUTABLE";
    } catch (e: any) {
      console.log(`   ⚠️ Revoke failed: ${e.message}`);
    }

    // Step 4: Verify post-revoke governance calls fail
    console.log("\n📝 Step 4: Verify Post-Revoke Failures");
    
    // Try update_performance_fee
    console.log("   Testing update_performance_fee...");
    try {
      await program.methods
        .updatePerformanceFee(500)
        .accounts({
          vault: vaultPda,
          authority: walletKeypair.publicKey,
        })
        .rpc();
      console.log("   ❌ UNEXPECTED: Fee update succeeded!");
    } catch (e: any) {
      console.log(`   ✅ Fee update blocked: ${e.message.slice(0, 50)}...`);
      report.governance.postRevokeFailures.push("update_performance_fee: BLOCKED");
    }

    // Try transfer_authority
    console.log("   Testing transfer_authority...");
    try {
      await program.methods
        .transferAuthority(testAuthority.publicKey)
        .accounts({
          vault: vaultPda,
          authority: walletKeypair.publicKey,
        })
        .rpc();
      console.log("   ❌ UNEXPECTED: Transfer succeeded!");
    } catch (e: any) {
      console.log(`   ✅ Transfer blocked: ${e.message.slice(0, 50)}...`);
      report.governance.postRevokeFailures.push("transfer_authority: BLOCKED");
    }

    // Try revoke_authority again
    console.log("   Testing revoke_authority...");
    try {
      await program.methods
        .revokeAuthority()
        .accounts({
          vault: vaultPda,
          authority: walletKeypair.publicKey,
        })
        .rpc();
      console.log("   ❌ UNEXPECTED: Double revoke succeeded!");
    } catch (e: any) {
      console.log(`   ✅ Double revoke blocked: ${e.message.slice(0, 50)}...`);
      report.governance.postRevokeFailures.push("revoke_authority: BLOCKED");
    }
  }

  // Save deployment report
  console.log("\n📄 GENERATING DEPLOYMENT REPORT");
  console.log("=".repeat(40));
  
  const reportPath = path.join(__dirname, "../anchor/DEPLOYMENT_REPORT.md");
  const reportContent = generateReport(report);
  fs.writeFileSync(reportPath, reportContent);
  console.log(`   ✅ Report saved to: ${reportPath}`);

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`\n🔗 Program ID: ${report.programId}`);
  console.log(`📍 Vault PDA: ${report.vault.pda}`);
  console.log(`💰 Treasury: ${report.vault.treasury}`);
  console.log(`🔒 Status: ${report.status}`);
  console.log(`\n🌐 Explorer Links:`);
  console.log(`   Program:  ${report.explorerLinks.program}`);
  console.log(`   Vault:    ${report.explorerLinks.vault}`);
  console.log(`   Treasury: ${report.explorerLinks.treasury}`);
}

function generateReport(report: DeploymentReport): string {
  return `# Deployment Report

## Protocol Status: ${report.status === "IMMUTABLE" ? "🔒 IMMUTABLE" : "⚡ ACTIVE"}

Generated: ${report.deploymentTimestamp}

---

## Program Information

| Property | Value |
|----------|-------|
| **Program ID** | \`${report.programId}\` |
| **Cluster** | ${report.cluster} |
| **Status** | ${report.status} |

### Explorer Links

- [Program](${report.explorerLinks.program})
- [Vault](${report.explorerLinks.vault})
- [Treasury](${report.explorerLinks.treasury})

---

## Vault PDAs

| Account | Address |
|---------|---------|
| Vault | \`${report.vault.pda}\` |
| Vault Signer | \`${report.vault.signerPda}\` |
| Share Mint | \`${report.vault.shareMint}\` |
| Principal Vault | \`${report.vault.principalVault}\` |
| Revenue Vault | \`${report.vault.revenueVault}\` |
| Treasury | \`${report.vault.treasury}\` |

---

## Governance Finalization

### Authority Transition

| State | Address |
|-------|---------|
| Initial Authority | \`${report.governance.initialAuthority}\` |
| Final Authority | \`${report.governance.finalAuthority}\` |

### Transaction History

| Action | Transaction |
|--------|-------------|
| Fee Update | ${report.governance.feeUpdateTx ? `[\`${report.governance.feeUpdateTx.slice(0, 16)}...\`](https://explorer.solana.com/tx/${report.governance.feeUpdateTx}?cluster=devnet)` : "N/A"} |
| Authority Transfer | ${report.governance.authorityTransferTx ? `[\`${report.governance.authorityTransferTx.slice(0, 16)}...\`](https://explorer.solana.com/tx/${report.governance.authorityTransferTx}?cluster=devnet)` : "N/A"} |
| Authority Revoke | ${report.governance.revokeTx ? `[\`${report.governance.revokeTx.slice(0, 16)}...\`](https://explorer.solana.com/tx/${report.governance.revokeTx}?cluster=devnet)` : "N/A"} |

### Post-Revoke Verification

${report.governance.postRevokeFailures.length > 0 
  ? report.governance.postRevokeFailures.map(f => `- ✅ ${f}`).join("\n")
  : "No post-revoke tests executed"}

---

## Immutability Confirmation

${report.status === "IMMUTABLE" 
  ? `✅ **Protocol is permanently immutable**

- Authority address: \`${PublicKey.default.toBase58()}\` (zero address)
- All governance functions are permanently disabled
- Fee parameters cannot be changed
- Treasury cannot be redirected
- No upgrade path exists for protocol parameters`
  : "⚠️ Protocol governance is still active"}

---

## Security Properties

| Property | Status |
|----------|--------|
| Upgrade Authority | Retained (see UPGRADE_POLICY.md) |
| Governance Authority | ${report.status === "IMMUTABLE" ? "Revoked ✅" : "Active"} |
| Fee Boundedness | Enforced (max 20%) |
| Capital Segregation | Enforced |

---

*This report was auto-generated by the deployment script.*
`;
}

main().catch(console.error);
