import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TokenizedYieldInfrastructure } from "../target/types/tokenized_yield_infrastructure";

describe("Tokenized Yield Lifecycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenizedYieldInfrastructure as Program<TokenizedYieldInfrastructure>;

  const payer = provider.wallet;
  const vaultOwnerPubKey = payer.publicKey;

  let vaultPda: PublicKey;
  let vaultSignerPda: PublicKey;
  let vaultShareMintPda: PublicKey;
  let principalVaultPda: PublicKey;
  let revenueVaultPda: PublicKey;
  let treasuryPda: PublicKey;
  let paymentMint: PublicKey;

  let buyer: anchor.web3.Keypair;
  let buyerPaymentAta: PublicKey;

  beforeAll(async () => {
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), vaultOwnerPubKey.toBuffer()],
      program.programId
    );

    [vaultSignerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), vaultPda.toBuffer()],
      program.programId
    );

    [vaultShareMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_share_mint"), vaultPda.toBuffer()],
      program.programId
    );

    [principalVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("principal-vault"), vaultPda.toBuffer()],
      program.programId
    );

    [revenueVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("revenue-vault"), vaultPda.toBuffer()],
      program.programId
    );

    // Treasury PDA for performance fees
    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), vaultPda.toBuffer()],
      program.programId
    );


    paymentMint = await createMint(
      provider.connection,
      (payer as anchor.Wallet).payer,
      vaultOwnerPubKey,
      null,
      6
    );

    buyer = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(buyer.publicKey, 2e9)
    );

    buyerPaymentAta = await createAccount(
      provider.connection,
      (payer as anchor.Wallet).payer,
      paymentMint,
      buyer.publicKey
    );

    await mintTo(
      provider.connection,
      (payer as anchor.Wallet).payer,
      paymentMint,
      buyerPaymentAta,
      vaultOwnerPubKey,
      1_000_000_000
    );
  });

  it("initializes the Vault", async () => {
    await program.methods
      .initializeVault("Ramesh Vault", new anchor.BN(10_000_000_000), new anchor.BN(100), 1000) // 10% fee
      .accounts({
        owner: vaultOwnerPubKey,
        vault: vaultPda,
        vaultSigner: vaultSignerPda,
        paymentMint,
        principalVault: principalVaultPda,
        revenueVault: revenueVaultPda,
        treasury: treasuryPda,
        vaultShareMint: vaultShareMintPda,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([(payer as anchor.Wallet).payer])
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    expect(vaultAccount.owner.toString()).toBe(vaultOwnerPubKey.toString());
    // totalShares in BN is 10B. But the test says 1M? 
    // Wait, the initialize call says 10,000,000,000. 
    // The previously logged expectation was 1,000,000. 
    // I should fix the test to match the logic.
    expect(vaultAccount.totalShares.toString()).toBe("10000000000");
    expect(vaultAccount.pricePerShare.toNumber()).toBe(100);
    expect(vaultAccount.performanceFeeBps).toBe(1000); // 10%
    expect(vaultAccount.treasury.toString()).toBe(treasuryPda.toString());
    expect(vaultAccount.totalFeesCollected.toNumber()).toBe(0);
    // Governance: authority should be set to owner
    expect(vaultAccount.authority.toString()).toBe(vaultOwnerPubKey.toString());
  });

  it("mints shares", async () => {
    const amount = new anchor.BN(500);
    const payAmount = new anchor.BN(50_000);

    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );

    // derive ATA
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });

    await program.methods
      .mintShares(amount)
      .accounts({
        vault: vaultPda,
        vaultSigner: vaultSignerPda,
        payer: buyer.publicKey,
        payerAta: buyerPaymentAta,
        principalVault: principalVaultPda,
        revenueVault: revenueVaultPda,
        vaultShareMint: vaultShareMintPda,
        shareholder: shareholderPda,
        investorShareAta: investorShareAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    expect(vaultAccount.mintedShares.toNumber()).toBe(500);

    const shareholder = await program.account.userStake.fetch(shareholderPda);
    expect(shareholder.owner.toBase58()).toBe(buyer.publicKey.toBase58());
    expect(shareholder.quantity.toNumber()).toBe(500);
    expect(shareholder.vault.toString()).toBe(vaultPda.toString());
  });

  it("fails if amount == 0", async () => {
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });
    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );

    const tx = program.methods
      .mintShares(new anchor.BN(0))
      .accounts({
        vault: vaultPda,
        vaultSigner: vaultSignerPda,
        payer: buyer.publicKey,
        payerAta: buyerPaymentAta,
        principalVault: principalVaultPda,
        revenueVault: revenueVaultPda,
        vaultShareMint: vaultShareMintPda,
        shareholder: shareholderPda,
        investorShareAta: investorShareAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer]);

    await expect(tx.rpc()).rejects.toThrow("InvalidShareAmount");
  });

  it("mints large amount of shares (u64 check)", async () => {
    await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, buyerPaymentAta, vaultOwnerPubKey, 500_000_000_000);
    const amount = new anchor.BN(4_500_000_000);

    const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()], program.programId);
    const investorShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: buyer.publicKey });

    await program.methods.mintShares(amount).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, payerAta: buyerPaymentAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda, investorShareAta: investorShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc();

    const shareholder = await program.account.userStake.fetch(shareholderPda);
    expect(shareholder.quantity.toString()).toBe("4500000500");
  });

  it("fails with invalid payment mint", async () => {
    const fakeMint = await createMint(provider.connection, (payer as anchor.Wallet).payer, vaultOwnerPubKey, null, 6);
    const fakeAta = await createAccount(provider.connection, (payer as anchor.Wallet).payer, fakeMint, buyer.publicKey);
    const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()], program.programId);
    const investorShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: buyer.publicKey });

    const tx = program.methods.mintShares(new anchor.BN(10)).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, payerAta: fakeAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda, investorShareAta: investorShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([buyer]);

    await expect(tx.rpc()).rejects.toThrow();
  });

  // --- INVARIANT HELPERS ---
  async function assertVaultInvariant() {
    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const shareholders = await program.account.userStake.all([{ memcmp: { offset: 8 + 1 + 32, bytes: vaultPda.toBase58() } }]);
    const totalUserShares = shareholders.reduce((acc, s) => acc.add(new anchor.BN(s.account.quantity)), new anchor.BN(0));
    expect(totalUserShares.toString()).toBe(vaultAccount.mintedShares.toString());
  }

  // --- FORMAL INVARIANTS TESTS ---
  it("INVARIANT: Supply Cap Enforcement", async () => {
    const amount = new anchor.BN(6_000_000_000);
    const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()], program.programId);
    const investorShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: buyer.publicKey });

    await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, buyerPaymentAta, vaultOwnerPubKey, 600_000_000_000);

    const tx = program.methods.mintShares(amount).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, payerAta: buyerPaymentAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda, investorShareAta: investorShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([buyer]);

    await expect(tx.rpc()).rejects.toThrow("ExceedsTotalSupply");
    await assertVaultInvariant();
  });

  it("INVARIANT: Economic Integrity", async () => {
    const amount = new anchor.BN(100);
    const expectedPayment = amount.mul(new anchor.BN(100));
    const startVaultBalance = (await provider.connection.getTokenAccountBalance(principalVaultPda)).value.amount;
    const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()], program.programId);
    const investorShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: buyer.publicKey });

    await program.methods.mintShares(amount).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, payerAta: buyerPaymentAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda, investorShareAta: investorShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc();

    const endVaultBalance = (await provider.connection.getTokenAccountBalance(principalVaultPda)).value.amount;
    expect(new anchor.BN(endVaultBalance).sub(new anchor.BN(startVaultBalance)).toString()).toBe(expectedPayment.toString());
    await assertVaultInvariant();
  });

  it("INVARIANT: Shareholder Conservation", async () => {
    const buyer2 = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(buyer2.publicKey, 1e9));
    const buyer2PaymentAta = await createAccount(provider.connection, (payer as anchor.Wallet).payer, paymentMint, buyer2.publicKey);
    await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, buyer2PaymentAta, vaultOwnerPubKey, 1_000_000);
    const [shareholder2Pda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer2.publicKey.toBuffer()], program.programId);
    const investorShareAta2 = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: buyer2.publicKey });

    await program.methods.mintShares(new anchor.BN(50)).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer2.publicKey, payerAta: buyer2PaymentAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: shareholder2Pda, investorShareAta: investorShareAta2, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([buyer2]).rpc();

    await assertVaultInvariant();
  });

  it("INVARIANT: Zero Amount Rejection", async () => {
    const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()], program.programId);
    const investorShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: buyer.publicKey });
    const tx = program.methods.mintShares(new anchor.BN(0)).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, payerAta: buyerPaymentAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda, investorShareAta: investorShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([buyer]);
    await expect(tx.rpc()).rejects.toThrow("InvalidShareAmount");
  });

  // --- REVENUE ENGINE TESTS ---
  it("REVENUE: Single User Distribution", async () => {
    const user = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(user.publicKey, 1e9));
    const userPaymentAta = await createAccount(provider.connection, (payer as anchor.Wallet).payer, paymentMint, user.publicKey);
    await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, userPaymentAta, vaultOwnerPubKey, 1_000_000);
    const [userShareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), user.publicKey.toBuffer()], program.programId);
    const userShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: user.publicKey });

    await program.methods.mintShares(new anchor.BN(100)).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: user.publicKey, payerAta: userPaymentAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: userShareholderPda, investorShareAta: userShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();

    await program.methods.depositRevenue(new anchor.BN(10_000)).accounts({
      vault: vaultPda, payer: (payer as anchor.Wallet).publicKey, payerAta: buyerPaymentAta,
      revenueVault: revenueVaultPda, treasury: treasuryPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([(payer as anchor.Wallet).payer]).rpc();

    const initialBalance = (await provider.connection.getTokenAccountBalance(userPaymentAta)).value.amount;
    await program.methods.harvest().accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: user.publicKey, shareholder: userShareholderPda,
      revenueVault: revenueVaultPda, userAta: userPaymentAta, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc();
    const finalBalance = (await provider.connection.getTokenAccountBalance(userPaymentAta)).value.amount;
    expect(new anchor.BN(finalBalance).sub(new anchor.BN(initialBalance)).gt(new anchor.BN(0))).toBe(true);
  });

  it("REVENUE: Large Revenue Overflow Guard", async () => {
    const hugeRevenue = new anchor.BN("10000000000000000");
    await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, buyerPaymentAta, vaultOwnerPubKey, 10_000_000_000_000_000_000);
    await program.methods.depositRevenue(hugeRevenue).accounts({
      vault: vaultPda, payer: (payer as anchor.Wallet).publicKey, payerAta: buyerPaymentAta,
      revenueVault: revenueVaultPda, treasury: treasuryPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([(payer as anchor.Wallet).payer]).rpc();
  });

  it("REVENUE: Harvest without new revenue", async () => {
    const [buyerShareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()], program.programId);
    await program.methods.harvest().accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, shareholder: buyerShareholderPda,
      revenueVault: revenueVaultPda, userAta: buyerPaymentAta, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([buyer]).rpc();
  });

  // --- REDEMPTION ENGINE TESTS ---
  it("REDEEM: Single User Full Exit", async () => {
    const user = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(user.publicKey, 1e9));
    const userPaymentAta = await createAccount(provider.connection, (payer as anchor.Wallet).payer, paymentMint, user.publicKey);
    await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, userPaymentAta, vaultOwnerPubKey, 1_000_000);
    const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), user.publicKey.toBuffer()], program.programId);
    const userShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: user.publicKey });

    await program.methods.mintShares(new anchor.BN(50)).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: user.publicKey, payerAta: userPaymentAta,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda, investorShareAta: userShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).signers([user]).rpc();

    const startBalance = (await provider.connection.getTokenAccountBalance(userPaymentAta)).value.amount;
    await program.methods.redeemShares(new anchor.BN(50)).accounts({
      vault: vaultPda, vaultSigner: vaultSignerPda, payer: user.publicKey, shareholder: shareholderPda,
      principalVault: principalVaultPda, revenueVault: revenueVaultPda, investorShareAta: userShareAta,
      vaultShareMint: vaultShareMintPda, payerAta: userPaymentAta, tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([user]).rpc();

    const endBalance = (await provider.connection.getTokenAccountBalance(userPaymentAta)).value.amount;
    expect(new anchor.BN(endBalance).sub(new anchor.BN(startBalance)).toNumber()).toBe(5000);
  });

  // --- ADVERSARIAL & STRESS TESTS ---
  async function assertFullInvariant() {
    const vault = await program.account.vault.fetch(vaultPda);
    const shareholders = await program.account.userStake.all([{ memcmp: { offset: 8 + 1 + 32, bytes: vaultPda.toBase58() } }]);
    const totalUserShares = shareholders.reduce((acc, s) => acc.add(new anchor.BN(s.account.quantity)), new anchor.BN(0));
    expect(totalUserShares.toString()).toBe(vault.mintedShares.toString());
    const remainder = new anchor.BN(vault.rewardRemainder);
    const minted = new anchor.BN(vault.mintedShares);
    if (minted.gt(new anchor.BN(0))) expect(remainder.lt(minted)).toBe(true);
  }

  describe("Adversarial Tests", () => {
    it("ADV-1: Mint-Front-Run Revenue", async () => {
      const userA = anchor.web3.Keypair.generate();
      const userB = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(userA.publicKey, 1e9));
      const ataA = await createAccount(provider.connection, (payer as anchor.Wallet).payer, paymentMint, userA.publicKey);
      await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, ataA, vaultOwnerPubKey, 1_000_000);
      const [pdaA] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), userA.publicKey.toBuffer()], program.programId);
      const shareAtaA = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: userA.publicKey });
      await program.methods.mintShares(new anchor.BN(100)).accounts({
        vault: vaultPda, vaultSigner: vaultSignerPda, payer: userA.publicKey, payerAta: ataA,
        principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
        shareholder: pdaA, investorShareAta: shareAtaA, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([userA]).rpc();

      await program.methods.depositRevenue(new anchor.BN(1000)).accounts({
        vault: vaultPda, payer: (payer as anchor.Wallet).publicKey, payerAta: buyerPaymentAta,
        revenueVault: revenueVaultPda, treasury: treasuryPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([(payer as anchor.Wallet).payer]).rpc();

      await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(userB.publicKey, 1e9));
      const ataB = await createAccount(provider.connection, (payer as anchor.Wallet).payer, paymentMint, userB.publicKey);
      await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, ataB, vaultOwnerPubKey, 1_000_000);
      const [pdaB] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), userB.publicKey.toBuffer()], program.programId);
      const shareAtaB = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: userB.publicKey });
      await program.methods.mintShares(new anchor.BN(100)).accounts({
        vault: vaultPda, vaultSigner: vaultSignerPda, payer: userB.publicKey, payerAta: ataB,
        principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
        shareholder: pdaB, investorShareAta: shareAtaB, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([userB]).rpc();

      const preA = (await provider.connection.getTokenAccountBalance(ataA)).value.amount;
      await program.methods.harvest().accounts({
        vault: vaultPda, vaultSigner: vaultSignerPda, payer: userA.publicKey, shareholder: pdaA,
        revenueVault: revenueVaultPda, userAta: ataA, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([userA]).rpc();
      const postA = (await provider.connection.getTokenAccountBalance(ataA)).value.amount;
      expect(new anchor.BN(postA).sub(new anchor.BN(preA)).gt(new anchor.BN(0))).toBe(true);

      const preB = (await provider.connection.getTokenAccountBalance(ataB)).value.amount;
      await program.methods.harvest().accounts({
        vault: vaultPda, vaultSigner: vaultSignerPda, payer: userB.publicKey, shareholder: pdaB,
        revenueVault: revenueVaultPda, userAta: ataB, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([userB]).rpc();
      const postB = (await provider.connection.getTokenAccountBalance(ataB)).value.amount;
      expect(new anchor.BN(postB).sub(new anchor.BN(preB)).toNumber()).toBe(0);
      await assertFullInvariant();
    });

    it("ADV-2: Rapid Harvest Loop", async () => {
      const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()], program.programId);
      await program.methods.harvest().accounts({
        vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, shareholder: shareholderPda,
        revenueVault: revenueVaultPda, userAta: buyerPaymentAta, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([buyer]).rpc();
      const balanceInterim = (await provider.connection.getTokenAccountBalance(buyerPaymentAta)).value.amount;
      await program.methods.harvest().accounts({
        vault: vaultPda, vaultSigner: vaultSignerPda, payer: buyer.publicKey, shareholder: shareholderPda,
        revenueVault: revenueVaultPda, userAta: buyerPaymentAta, tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([buyer]).rpc();
      const balanceFinal = (await provider.connection.getTokenAccountBalance(buyerPaymentAta)).value.amount;
      expect(balanceFinal).toBe(balanceInterim);
      await assertFullInvariant();
    });

    it("ADV-3: Remainder Grinding Simulation", async () => {
      for (let i = 0; i < 5; i++) {
        await program.methods.depositRevenue(new anchor.BN(1)).accounts({
          vault: vaultPda, payer: (payer as anchor.Wallet).publicKey, payerAta: buyerPaymentAta,
          revenueVault: revenueVaultPda, treasury: treasuryPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([(payer as anchor.Wallet).payer]).rpc();
      }
      await assertFullInvariant();
    });

    it("ADV-5: Partial Redeem Edge", async () => {
      const user = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(user.publicKey, 1e9));
      const userPaymentAta = await createAccount(provider.connection, (payer as anchor.Wallet).payer, paymentMint, user.publicKey);
      await mintTo(provider.connection, (payer as anchor.Wallet).payer, paymentMint, userPaymentAta, vaultOwnerPubKey, 1_000_000);
      const [shareholderPda] = PublicKey.findProgramAddressSync([Buffer.from("shareholder"), vaultPda.toBuffer(), user.publicKey.toBuffer()], program.programId);
      const userShareAta = await anchor.utils.token.associatedAddress({ mint: vaultShareMintPda, owner: user.publicKey });
      await program.methods.mintShares(new anchor.BN(5)).accounts({
        vault: vaultPda, vaultSigner: vaultSignerPda, payer: user.publicKey, payerAta: userPaymentAta,
        principalVault: principalVaultPda, revenueVault: revenueVaultPda, vaultShareMint: vaultShareMintPda,
        shareholder: shareholderPda, investorShareAta: userShareAta, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([user]).rpc();
      for (let i = 0; i < 5; i++) {
        await program.methods.redeemShares(new anchor.BN(1)).accounts({
          vault: vaultPda, vaultSigner: vaultSignerPda, payer: user.publicKey, shareholder: shareholderPda,
          principalVault: principalVaultPda, revenueVault: revenueVaultPda, investorShareAta: userShareAta,
          vaultShareMint: vaultShareMintPda, payerAta: userPaymentAta, tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([user]).rpc();
      }
      expect((await program.account.userStake.fetch(shareholderPda)).quantity.toNumber()).toBe(0);
      await assertFullInvariant();
    });
  });
});

// =============================================================================
// PERFORMANCE FEE LAYER TESTS
// =============================================================================
describe("Performance Fee Layer", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenizedYieldInfrastructure as Program<TokenizedYieldInfrastructure>;

  const payer = provider.wallet;

  describe("Fee Calculation & Distribution", () => {
    let feeVaultPda: PublicKey;
    let feeVaultSignerPda: PublicKey;
    let feeVaultShareMintPda: PublicKey;
    let feePrincipalVaultPda: PublicKey;
    let feeRevenueVaultPda: PublicKey;
    let feeTreasuryPda: PublicKey;
    let feePaymentMint: PublicKey;
    let feeOwner: anchor.web3.Keypair;
    let shareholder: anchor.web3.Keypair;
    let shareholderPaymentAta: PublicKey;
    let depositorPaymentAta: PublicKey;

    beforeAll(async () => {
      feeOwner = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(feeOwner.publicKey, 5e9)
      );

      [feeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), feeOwner.publicKey.toBuffer()],
        program.programId
      );

      [feeVaultSignerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_signer"), feeVaultPda.toBuffer()],
        program.programId
      );

      [feeVaultShareMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_share_mint"), feeVaultPda.toBuffer()],
        program.programId
      );

      [feePrincipalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("principal-vault"), feeVaultPda.toBuffer()],
        program.programId
      );

      [feeRevenueVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue-vault"), feeVaultPda.toBuffer()],
        program.programId
      );

      [feeTreasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), feeVaultPda.toBuffer()],
        program.programId
      );

      feePaymentMint = await createMint(
        provider.connection,
        (payer as anchor.Wallet).payer,
        (payer as anchor.Wallet).publicKey,
        null,
        6
      );

      shareholder = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(shareholder.publicKey, 2e9)
      );

      shareholderPaymentAta = await createAccount(
        provider.connection,
        (payer as anchor.Wallet).payer,
        feePaymentMint,
        shareholder.publicKey
      );

      depositorPaymentAta = await createAccount(
        provider.connection,
        (payer as anchor.Wallet).payer,
        feePaymentMint,
        (payer as anchor.Wallet).publicKey
      );

      await mintTo(
        provider.connection,
        (payer as anchor.Wallet).payer,
        feePaymentMint,
        shareholderPaymentAta,
        (payer as anchor.Wallet).publicKey,
        100_000_000
      );

      await mintTo(
        provider.connection,
        (payer as anchor.Wallet).payer,
        feePaymentMint,
        depositorPaymentAta,
        (payer as anchor.Wallet).publicKey,
        100_000_000
      );
    });

    it("FEE-1: Revenue deposit with 10% fee - treasury receives exact fee", async () => {
      // Initialize vault with 10% fee (1000 bps)
      await program.methods
        .initializeVault("Fee Test Vault", new anchor.BN(1_000_000), new anchor.BN(100), 1000)
        .accounts({
          owner: feeOwner.publicKey,
          vault: feeVaultPda,
          vaultSigner: feeVaultSignerPda,
          paymentMint: feePaymentMint,
          principalVault: feePrincipalVaultPda,
          revenueVault: feeRevenueVaultPda,
          treasury: feeTreasuryPda,
          vaultShareMint: feeVaultShareMintPda,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([feeOwner])
        .rpc();

      // Mint shares to shareholder
      const [shareholderPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("shareholder"), feeVaultPda.toBuffer(), shareholder.publicKey.toBuffer()],
        program.programId
      );
      const shareholderShareAta = await anchor.utils.token.associatedAddress({
        mint: feeVaultShareMintPda,
        owner: shareholder.publicKey
      });

      await program.methods
        .mintShares(new anchor.BN(1000))
        .accounts({
          vault: feeVaultPda,
          vaultSigner: feeVaultSignerPda,
          payer: shareholder.publicKey,
          payerAta: shareholderPaymentAta,
          principalVault: feePrincipalVaultPda,
          revenueVault: feeRevenueVaultPda,
          vaultShareMint: feeVaultShareMintPda,
          shareholder: shareholderPda,
          investorShareAta: shareholderShareAta,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([shareholder])
        .rpc();

      // Record balances before deposit
      const treasuryBalanceBefore = (await provider.connection.getTokenAccountBalance(feeTreasuryPda)).value.amount;
      const revenueVaultBalanceBefore = (await provider.connection.getTokenAccountBalance(feeRevenueVaultPda)).value.amount;

      // Deposit 10,000 revenue (should split: 1,000 fee, 9,000 distributable)
      const revenueAmount = new anchor.BN(10_000);
      await program.methods
        .depositRevenue(revenueAmount)
        .accounts({
          vault: feeVaultPda,
          payer: (payer as anchor.Wallet).publicKey,
          payerAta: depositorPaymentAta,
          revenueVault: feeRevenueVaultPda,
          treasury: feeTreasuryPda,
          vaultSigner: feeVaultSignerPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([(payer as anchor.Wallet).payer])
        .rpc();

      // Verify treasury received exactly 10% fee
      const treasuryBalanceAfter = (await provider.connection.getTokenAccountBalance(feeTreasuryPda)).value.amount;
      const expectedFee = 1000; // 10% of 10,000
      expect(new anchor.BN(treasuryBalanceAfter).sub(new anchor.BN(treasuryBalanceBefore)).toNumber()).toBe(expectedFee);

      // Verify revenue vault received exactly 90% distributable
      const revenueVaultBalanceAfter = (await provider.connection.getTokenAccountBalance(feeRevenueVaultPda)).value.amount;
      const expectedDistributable = 9000; // 90% of 10,000
      expect(new anchor.BN(revenueVaultBalanceAfter).sub(new anchor.BN(revenueVaultBalanceBefore)).toNumber()).toBe(expectedDistributable);

      // Verify vault state tracks fees
      const vaultAccount = await program.account.vault.fetch(feeVaultPda);
      expect(vaultAccount.totalFeesCollected.toNumber()).toBe(expectedFee);
    });

    it("FEE-2: Shareholder receives exact remaining portion after fee", async () => {
      const [shareholderPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("shareholder"), feeVaultPda.toBuffer(), shareholder.publicKey.toBuffer()],
        program.programId
      );

      // Record shareholder balance before harvest
      const shareholderBalanceBefore = (await provider.connection.getTokenAccountBalance(shareholderPaymentAta)).value.amount;

      // Harvest rewards
      await program.methods
        .harvest()
        .accounts({
          vault: feeVaultPda,
          vaultSigner: feeVaultSignerPda,
          payer: shareholder.publicKey,
          shareholder: shareholderPda,
          revenueVault: feeRevenueVaultPda,
          userAta: shareholderPaymentAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([shareholder])
        .rpc();

      // Shareholder should receive the distributable amount (9,000)
      const shareholderBalanceAfter = (await provider.connection.getTokenAccountBalance(shareholderPaymentAta)).value.amount;
      const received = new anchor.BN(shareholderBalanceAfter).sub(new anchor.BN(shareholderBalanceBefore)).toNumber();
      
      // The shareholder owns 100% of shares, so they get 100% of distributable (9,000)
      expect(received).toBe(9000);
    });

    it("FEE-3: Multiple revenue deposits accumulate fees correctly", async () => {
      const vaultBefore = await program.account.vault.fetch(feeVaultPda);
      const totalFeesBefore = vaultBefore.totalFeesCollected.toNumber();
      const treasuryBefore = (await provider.connection.getTokenAccountBalance(feeTreasuryPda)).value.amount;

      // Deposit 5,000 more (should add 500 fee)
      await program.methods
        .depositRevenue(new anchor.BN(5000))
        .accounts({
          vault: feeVaultPda,
          payer: (payer as anchor.Wallet).publicKey,
          payerAta: depositorPaymentAta,
          revenueVault: feeRevenueVaultPda,
          treasury: feeTreasuryPda,
          vaultSigner: feeVaultSignerPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([(payer as anchor.Wallet).payer])
        .rpc();

      const vaultAfter = await program.account.vault.fetch(feeVaultPda);
      const treasuryAfter = (await provider.connection.getTokenAccountBalance(feeTreasuryPda)).value.amount;

      // Verify cumulative fee tracking
      expect(vaultAfter.totalFeesCollected.toNumber()).toBe(totalFeesBefore + 500);
      expect(new anchor.BN(treasuryAfter).sub(new anchor.BN(treasuryBefore)).toNumber()).toBe(500);
    });
  });

  describe("Zero Fee Vault", () => {
    let zeroFeeVaultPda: PublicKey;
    let zeroFeeVaultSignerPda: PublicKey;
    let zeroFeeVaultShareMintPda: PublicKey;
    let zeroFeePrincipalVaultPda: PublicKey;
    let zeroFeeRevenueVaultPda: PublicKey;
    let zeroFeeTreasuryPda: PublicKey;
    let zeroFeePaymentMint: PublicKey;
    let zeroFeeOwner: anchor.web3.Keypair;
    let zeroFeeShareholder: anchor.web3.Keypair;
    let zeroFeeShareholderPaymentAta: PublicKey;
    let zeroFeeDepositorPaymentAta: PublicKey;

    beforeAll(async () => {
      zeroFeeOwner = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(zeroFeeOwner.publicKey, 5e9)
      );

      [zeroFeeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), zeroFeeOwner.publicKey.toBuffer()],
        program.programId
      );

      [zeroFeeVaultSignerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_signer"), zeroFeeVaultPda.toBuffer()],
        program.programId
      );

      [zeroFeeVaultShareMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_share_mint"), zeroFeeVaultPda.toBuffer()],
        program.programId
      );

      [zeroFeePrincipalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("principal-vault"), zeroFeeVaultPda.toBuffer()],
        program.programId
      );

      [zeroFeeRevenueVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue-vault"), zeroFeeVaultPda.toBuffer()],
        program.programId
      );

      [zeroFeeTreasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), zeroFeeVaultPda.toBuffer()],
        program.programId
      );

      zeroFeePaymentMint = await createMint(
        provider.connection,
        (payer as anchor.Wallet).payer,
        (payer as anchor.Wallet).publicKey,
        null,
        6
      );

      zeroFeeShareholder = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(zeroFeeShareholder.publicKey, 2e9)
      );

      zeroFeeShareholderPaymentAta = await createAccount(
        provider.connection,
        (payer as anchor.Wallet).payer,
        zeroFeePaymentMint,
        zeroFeeShareholder.publicKey
      );

      zeroFeeDepositorPaymentAta = await createAccount(
        provider.connection,
        (payer as anchor.Wallet).payer,
        zeroFeePaymentMint,
        (payer as anchor.Wallet).publicKey
      );

      await mintTo(
        provider.connection,
        (payer as anchor.Wallet).payer,
        zeroFeePaymentMint,
        zeroFeeShareholderPaymentAta,
        (payer as anchor.Wallet).publicKey,
        100_000_000
      );

      await mintTo(
        provider.connection,
        (payer as anchor.Wallet).payer,
        zeroFeePaymentMint,
        zeroFeeDepositorPaymentAta,
        (payer as anchor.Wallet).publicKey,
        100_000_000
      );
    });

    it("FEE-4: 0% fee works - full amount goes to shareholders", async () => {
      // Initialize vault with 0% fee
      await program.methods
        .initializeVault("Zero Fee Vault", new anchor.BN(1_000_000), new anchor.BN(100), 0)
        .accounts({
          owner: zeroFeeOwner.publicKey,
          vault: zeroFeeVaultPda,
          vaultSigner: zeroFeeVaultSignerPda,
          paymentMint: zeroFeePaymentMint,
          principalVault: zeroFeePrincipalVaultPda,
          revenueVault: zeroFeeRevenueVaultPda,
          treasury: zeroFeeTreasuryPda,
          vaultShareMint: zeroFeeVaultShareMintPda,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([zeroFeeOwner])
        .rpc();

      // Verify fee is 0
      const vault = await program.account.vault.fetch(zeroFeeVaultPda);
      expect(vault.performanceFeeBps).toBe(0);

      // Mint shares
      const [shareholderPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("shareholder"), zeroFeeVaultPda.toBuffer(), zeroFeeShareholder.publicKey.toBuffer()],
        program.programId
      );
      const shareholderShareAta = await anchor.utils.token.associatedAddress({
        mint: zeroFeeVaultShareMintPda,
        owner: zeroFeeShareholder.publicKey
      });

      await program.methods
        .mintShares(new anchor.BN(1000))
        .accounts({
          vault: zeroFeeVaultPda,
          vaultSigner: zeroFeeVaultSignerPda,
          payer: zeroFeeShareholder.publicKey,
          payerAta: zeroFeeShareholderPaymentAta,
          principalVault: zeroFeePrincipalVaultPda,
          revenueVault: zeroFeeRevenueVaultPda,
          vaultShareMint: zeroFeeVaultShareMintPda,
          shareholder: shareholderPda,
          investorShareAta: shareholderShareAta,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([zeroFeeShareholder])
        .rpc();

      // Record balances
      const treasuryBefore = (await provider.connection.getTokenAccountBalance(zeroFeeTreasuryPda)).value.amount;
      const revenueVaultBefore = (await provider.connection.getTokenAccountBalance(zeroFeeRevenueVaultPda)).value.amount;

      // Deposit 10,000 revenue
      await program.methods
        .depositRevenue(new anchor.BN(10_000))
        .accounts({
          vault: zeroFeeVaultPda,
          payer: (payer as anchor.Wallet).publicKey,
          payerAta: zeroFeeDepositorPaymentAta,
          revenueVault: zeroFeeRevenueVaultPda,
          treasury: zeroFeeTreasuryPda,
          vaultSigner: zeroFeeVaultSignerPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([(payer as anchor.Wallet).payer])
        .rpc();

      // Treasury should receive 0
      const treasuryAfter = (await provider.connection.getTokenAccountBalance(zeroFeeTreasuryPda)).value.amount;
      expect(new anchor.BN(treasuryAfter).sub(new anchor.BN(treasuryBefore)).toNumber()).toBe(0);

      // Revenue vault should receive full amount
      const revenueVaultAfter = (await provider.connection.getTokenAccountBalance(zeroFeeRevenueVaultPda)).value.amount;
      expect(new anchor.BN(revenueVaultAfter).sub(new anchor.BN(revenueVaultBefore)).toNumber()).toBe(10_000);

      // Verify no fees tracked
      const vaultAfter = await program.account.vault.fetch(zeroFeeVaultPda);
      expect(vaultAfter.totalFeesCollected.toNumber()).toBe(0);

      // Harvest and verify shareholder gets full amount
      const shareholderBefore = (await provider.connection.getTokenAccountBalance(zeroFeeShareholderPaymentAta)).value.amount;
      
      await program.methods
        .harvest()
        .accounts({
          vault: zeroFeeVaultPda,
          vaultSigner: zeroFeeVaultSignerPda,
          payer: zeroFeeShareholder.publicKey,
          shareholder: shareholderPda,
          revenueVault: zeroFeeRevenueVaultPda,
          userAta: zeroFeeShareholderPaymentAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([zeroFeeShareholder])
        .rpc();

      const shareholderAfter = (await provider.connection.getTokenAccountBalance(zeroFeeShareholderPaymentAta)).value.amount;
      expect(new anchor.BN(shareholderAfter).sub(new anchor.BN(shareholderBefore)).toNumber()).toBe(10_000);
    });
  });

  describe("Fee Boundedness", () => {
    it("FEE-5: >20% fee fails at initialization", async () => {
      const invalidFeeOwner = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(invalidFeeOwner.publicKey, 2e9)
      );

      const [invalidVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), invalidFeeOwner.publicKey.toBuffer()],
        program.programId
      );

      const [invalidVaultSignerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_signer"), invalidVaultPda.toBuffer()],
        program.programId
      );

      const [invalidVaultShareMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_share_mint"), invalidVaultPda.toBuffer()],
        program.programId
      );

      const [invalidPrincipalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("principal-vault"), invalidVaultPda.toBuffer()],
        program.programId
      );

      const [invalidRevenueVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue-vault"), invalidVaultPda.toBuffer()],
        program.programId
      );

      const [invalidTreasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), invalidVaultPda.toBuffer()],
        program.programId
      );

      const invalidPaymentMint = await createMint(
        provider.connection,
        (payer as anchor.Wallet).payer,
        (payer as anchor.Wallet).publicKey,
        null,
        6
      );

      // Try to initialize with 21% fee (2100 bps) - should fail
      const tx = program.methods
        .initializeVault("Invalid Fee Vault", new anchor.BN(1_000_000), new anchor.BN(100), 2100)
        .accounts({
          owner: invalidFeeOwner.publicKey,
          vault: invalidVaultPda,
          vaultSigner: invalidVaultSignerPda,
          paymentMint: invalidPaymentMint,
          principalVault: invalidPrincipalVaultPda,
          revenueVault: invalidRevenueVaultPda,
          treasury: invalidTreasuryPda,
          vaultShareMint: invalidVaultShareMintPda,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([invalidFeeOwner]);

      await expect(tx.rpc()).rejects.toThrow("PerformanceFeeExceedsMax");
    });

    it("FEE-6: Exactly 20% fee is allowed", async () => {
      const maxFeeOwner = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(maxFeeOwner.publicKey, 2e9)
      );

      const [maxFeeVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), maxFeeOwner.publicKey.toBuffer()],
        program.programId
      );

      const [maxFeeVaultSignerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_signer"), maxFeeVaultPda.toBuffer()],
        program.programId
      );

      const [maxFeeVaultShareMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_share_mint"), maxFeeVaultPda.toBuffer()],
        program.programId
      );

      const [maxFeePrincipalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("principal-vault"), maxFeeVaultPda.toBuffer()],
        program.programId
      );

      const [maxFeeRevenueVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue-vault"), maxFeeVaultPda.toBuffer()],
        program.programId
      );

      const [maxFeeTreasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), maxFeeVaultPda.toBuffer()],
        program.programId
      );

      const maxFeePaymentMint = await createMint(
        provider.connection,
        (payer as anchor.Wallet).payer,
        (payer as anchor.Wallet).publicKey,
        null,
        6
      );

      // Initialize with exactly 20% fee (2000 bps) - should succeed
      await program.methods
        .initializeVault("Max Fee Vault", new anchor.BN(1_000_000), new anchor.BN(100), 2000)
        .accounts({
          owner: maxFeeOwner.publicKey,
          vault: maxFeeVaultPda,
          vaultSigner: maxFeeVaultSignerPda,
          paymentMint: maxFeePaymentMint,
          principalVault: maxFeePrincipalVaultPda,
          revenueVault: maxFeeRevenueVaultPda,
          treasury: maxFeeTreasuryPda,
          vaultShareMint: maxFeeVaultShareMintPda,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maxFeeOwner])
        .rpc();

      const vault = await program.account.vault.fetch(maxFeeVaultPda);
      expect(vault.performanceFeeBps).toBe(2000);
    });
  });
});

// =============================================================================
// GOVERNANCE TEST SUITE
// =============================================================================
describe("Governance Controls", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenizedYieldInfrastructure as Program<TokenizedYieldInfrastructure>;

  const payer = provider.wallet;

  let govVaultPda: PublicKey;
  let govVaultSignerPda: PublicKey;
  let govVaultShareMintPda: PublicKey;
  let govPrincipalVaultPda: PublicKey;
  let govRevenueVaultPda: PublicKey;
  let govTreasuryPda: PublicKey;
  let govPaymentMint: PublicKey;
  let govOwner: anchor.web3.Keypair;
  let unauthorizedUser: anchor.web3.Keypair;

  beforeAll(async () => {
    govOwner = anchor.web3.Keypair.generate();
    unauthorizedUser = anchor.web3.Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(govOwner.publicKey, 5e9)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(unauthorizedUser.publicKey, 2e9)
    );

    [govVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), govOwner.publicKey.toBuffer()],
      program.programId
    );

    [govVaultSignerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), govVaultPda.toBuffer()],
      program.programId
    );

    [govVaultShareMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_share_mint"), govVaultPda.toBuffer()],
      program.programId
    );

    [govPrincipalVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("principal-vault"), govVaultPda.toBuffer()],
      program.programId
    );

    [govRevenueVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("revenue-vault"), govVaultPda.toBuffer()],
      program.programId
    );

    [govTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), govVaultPda.toBuffer()],
      program.programId
    );

    govPaymentMint = await createMint(
      provider.connection,
      (payer as anchor.Wallet).payer,
      (payer as anchor.Wallet).publicKey,
      null,
      6
    );

    // Initialize the governance test vault
    await program.methods
      .initializeVault("Governance Test Vault", new anchor.BN(1_000_000), new anchor.BN(100), 500)
      .accounts({
        owner: govOwner.publicKey,
        vault: govVaultPda,
        vaultSigner: govVaultSignerPda,
        paymentMint: govPaymentMint,
        principalVault: govPrincipalVaultPda,
        revenueVault: govRevenueVaultPda,
        treasury: govTreasuryPda,
        vaultShareMint: govVaultShareMintPda,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([govOwner])
      .rpc();
  });

  it("GOV-1: Unauthorized fee update fails", async () => {
    const tx = program.methods
      .updatePerformanceFee(1500)
      .accounts({
        vault: govVaultPda,
        authority: unauthorizedUser.publicKey,
      })
      .signers([unauthorizedUser]);

    await expect(tx.rpc()).rejects.toThrow("Unauthorized");
  });

  it("GOV-2: Authorized fee update succeeds", async () => {
    await program.methods
      .updatePerformanceFee(1500)
      .accounts({
        vault: govVaultPda,
        authority: govOwner.publicKey,
      })
      .signers([govOwner])
      .rpc();

    const vault = await program.account.vault.fetch(govVaultPda);
    expect(vault.performanceFeeBps).toBe(1500);
  });

  it("GOV-3: Fee above 2000 bps fails", async () => {
    const tx = program.methods
      .updatePerformanceFee(2500)
      .accounts({
        vault: govVaultPda,
        authority: govOwner.publicKey,
      })
      .signers([govOwner]);

    await expect(tx.rpc()).rejects.toThrow("PerformanceFeeExceedsMax");
  });

  it("GOV-4: Authority transfer works", async () => {
    const newAuthority = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(newAuthority.publicKey, 1e9)
    );

    // Transfer authority
    await program.methods
      .transferAuthority(newAuthority.publicKey)
      .accounts({
        vault: govVaultPda,
        authority: govOwner.publicKey,
      })
      .signers([govOwner])
      .rpc();

    // Verify new authority
    let vault = await program.account.vault.fetch(govVaultPda);
    expect(vault.authority.toString()).toBe(newAuthority.publicKey.toString());

    // Old authority should fail
    const oldAuthorityTx = program.methods
      .updatePerformanceFee(1000)
      .accounts({
        vault: govVaultPda,
        authority: govOwner.publicKey,
      })
      .signers([govOwner]);

    await expect(oldAuthorityTx.rpc()).rejects.toThrow();

    // New authority should succeed
    await program.methods
      .updatePerformanceFee(1000)
      .accounts({
        vault: govVaultPda,
        authority: newAuthority.publicKey,
      })
      .signers([newAuthority])
      .rpc();

    vault = await program.account.vault.fetch(govVaultPda);
    expect(vault.performanceFeeBps).toBe(1000);

    // Transfer back for remaining tests
    await program.methods
      .transferAuthority(govOwner.publicKey)
      .accounts({
        vault: govVaultPda,
        authority: newAuthority.publicKey,
      })
      .signers([newAuthority])
      .rpc();
  });

  it("GOV-5: After revoke -> all governance calls fail", async () => {
    // Create a separate vault for revocation test (to not affect other tests)
    const revokeOwner = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(revokeOwner.publicKey, 5e9)
    );

    const [revokeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), revokeOwner.publicKey.toBuffer()],
      program.programId
    );

    const [revokeVaultSignerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), revokeVaultPda.toBuffer()],
      program.programId
    );

    const [revokeVaultShareMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_share_mint"), revokeVaultPda.toBuffer()],
      program.programId
    );

    const [revokePrincipalVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("principal-vault"), revokeVaultPda.toBuffer()],
      program.programId
    );

    const [revokeRevenueVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("revenue-vault"), revokeVaultPda.toBuffer()],
      program.programId
    );

    const [revokeTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), revokeVaultPda.toBuffer()],
      program.programId
    );

    const revokePaymentMint = await createMint(
      provider.connection,
      (payer as anchor.Wallet).payer,
      (payer as anchor.Wallet).publicKey,
      null,
      6
    );

    // Initialize vault
    await program.methods
      .initializeVault("Revoke Test Vault", new anchor.BN(1_000_000), new anchor.BN(100), 500)
      .accounts({
        owner: revokeOwner.publicKey,
        vault: revokeVaultPda,
        vaultSigner: revokeVaultSignerPda,
        paymentMint: revokePaymentMint,
        principalVault: revokePrincipalVaultPda,
        revenueVault: revokeRevenueVaultPda,
        treasury: revokeTreasuryPda,
        vaultShareMint: revokeVaultShareMintPda,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([revokeOwner])
      .rpc();

    // Verify authority is set
    let vault = await program.account.vault.fetch(revokeVaultPda);
    expect(vault.authority.toString()).toBe(revokeOwner.publicKey.toString());

    // Revoke authority
    await program.methods
      .revokeAuthority()
      .accounts({
        vault: revokeVaultPda,
        authority: revokeOwner.publicKey,
      })
      .signers([revokeOwner])
      .rpc();

    // Verify authority is now default (zero)
    vault = await program.account.vault.fetch(revokeVaultPda);
    expect(vault.authority.toString()).toBe(PublicKey.default.toString());

    // All governance calls should now fail with GovernanceDisabled

    // update_performance_fee should fail
    const feeTx = program.methods
      .updatePerformanceFee(1000)
      .accounts({
        vault: revokeVaultPda,
        authority: revokeOwner.publicKey,
      })
      .signers([revokeOwner]);

    await expect(feeTx.rpc()).rejects.toThrow();

    // transfer_authority should fail
    const transferTx = program.methods
      .transferAuthority(revokeOwner.publicKey)
      .accounts({
        vault: revokeVaultPda,
        authority: revokeOwner.publicKey,
      })
      .signers([revokeOwner]);

    await expect(transferTx.rpc()).rejects.toThrow();

    // revoke_authority should fail (already revoked)
    const revokeTx = program.methods
      .revokeAuthority()
      .accounts({
        vault: revokeVaultPda,
        authority: revokeOwner.publicKey,
      })
      .signers([revokeOwner]);

    await expect(revokeTx.rpc()).rejects.toThrow();
  });

  it("GOV-6: Cannot transfer authority to zero address", async () => {
    const tx = program.methods
      .transferAuthority(PublicKey.default)
      .accounts({
        vault: govVaultPda,
        authority: govOwner.publicKey,
      })
      .signers([govOwner]);

    await expect(tx.rpc()).rejects.toThrow("InvalidAuthority");
  });
});

// =============================================================================
// FUZZ INVARIANT ENGINE
// =============================================================================
describe("Fuzz Invariant Engine", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenizedYieldInfrastructure as Program<TokenizedYieldInfrastructure>;

  const payer = provider.wallet;

  let fuzzVaultPda: PublicKey;
  let fuzzVaultSignerPda: PublicKey;
  let fuzzVaultShareMintPda: PublicKey;
  let fuzzPrincipalVaultPda: PublicKey;
  let fuzzRevenueVaultPda: PublicKey;
  let fuzzTreasuryPda: PublicKey;
  let fuzzPaymentMint: PublicKey;
  let fuzzOwner: anchor.web3.Keypair;
  let fuzzUsers: anchor.web3.Keypair[] = [];
  let fuzzUserAtas: PublicKey[] = [];
  let fuzzUserShareholderPdas: PublicKey[] = [];
  let fuzzUserShareAtas: PublicKey[] = [];
  let depositorAta: PublicKey;

  const NUM_USERS = 5;
  const NUM_OPERATIONS = 100;

  // Helper to get random int
  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Full invariant check
  async function assertAllInvariants() {
    const vault = await program.account.vault.fetch(fuzzVaultPda);
    
    // 1. Share Conservation Invariant
    const shareholders = await program.account.userStake.all([
      { memcmp: { offset: 8 + 1 + 32, bytes: fuzzVaultPda.toBase58() } }
    ]);
    const totalUserShares = shareholders.reduce(
      (acc, s) => acc.add(new anchor.BN(s.account.quantity)), 
      new anchor.BN(0)
    );
    expect(totalUserShares.toString()).toBe(vault.mintedShares.toString());

    // 2. Supply Cap Invariant
    expect(vault.mintedShares.lte(vault.totalShares)).toBe(true);

    // 3. Remainder Bound Invariant
    if (vault.mintedShares.gt(new anchor.BN(0))) {
      expect(new anchor.BN(vault.rewardRemainder.toString()).lt(vault.mintedShares)).toBe(true);
    }

    // 4. Principal Solvency Invariant
    const principalBalance = (await provider.connection.getTokenAccountBalance(fuzzPrincipalVaultPda)).value.amount;
    const expectedPrincipal = vault.mintedShares.mul(vault.pricePerShare);
    expect(new anchor.BN(principalBalance).gte(expectedPrincipal)).toBe(true);

    // 5. Treasury Accounting Invariant
    const treasuryBalance = (await provider.connection.getTokenAccountBalance(fuzzTreasuryPda)).value.amount;
    expect(new anchor.BN(treasuryBalance).toString()).toBe(vault.totalFeesCollected.toString());
  }

  beforeAll(async () => {
    fuzzOwner = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(fuzzOwner.publicKey, 10e9)
    );

    [fuzzVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), fuzzOwner.publicKey.toBuffer()],
      program.programId
    );

    [fuzzVaultSignerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_signer"), fuzzVaultPda.toBuffer()],
      program.programId
    );

    [fuzzVaultShareMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_share_mint"), fuzzVaultPda.toBuffer()],
      program.programId
    );

    [fuzzPrincipalVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("principal-vault"), fuzzVaultPda.toBuffer()],
      program.programId
    );

    [fuzzRevenueVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("revenue-vault"), fuzzVaultPda.toBuffer()],
      program.programId
    );

    [fuzzTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), fuzzVaultPda.toBuffer()],
      program.programId
    );

    fuzzPaymentMint = await createMint(
      provider.connection,
      (payer as anchor.Wallet).payer,
      (payer as anchor.Wallet).publicKey,
      null,
      6
    );

    // Setup depositor ATA for revenue deposits
    depositorAta = await createAccount(
      provider.connection,
      (payer as anchor.Wallet).payer,
      fuzzPaymentMint,
      (payer as anchor.Wallet).publicKey
    );
    await mintTo(
      provider.connection,
      (payer as anchor.Wallet).payer,
      fuzzPaymentMint,
      depositorAta,
      (payer as anchor.Wallet).publicKey,
      1_000_000_000_000
    );

    // Setup users
    for (let i = 0; i < NUM_USERS; i++) {
      const user = anchor.web3.Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(user.publicKey, 2e9)
      );

      const userAta = await createAccount(
        provider.connection,
        (payer as anchor.Wallet).payer,
        fuzzPaymentMint,
        user.publicKey
      );

      await mintTo(
        provider.connection,
        (payer as anchor.Wallet).payer,
        fuzzPaymentMint,
        userAta,
        (payer as anchor.Wallet).publicKey,
        100_000_000
      );

      const [shareholderPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("shareholder"), fuzzVaultPda.toBuffer(), user.publicKey.toBuffer()],
        program.programId
      );

      fuzzUsers.push(user);
      fuzzUserAtas.push(userAta);
      fuzzUserShareholderPdas.push(shareholderPda);
    }

    // Initialize fuzz test vault with 10% fee
    await program.methods
      .initializeVault("Fuzz Test Vault", new anchor.BN(100_000_000), new anchor.BN(100), 1000)
      .accounts({
        owner: fuzzOwner.publicKey,
        vault: fuzzVaultPda,
        vaultSigner: fuzzVaultSignerPda,
        paymentMint: fuzzPaymentMint,
        principalVault: fuzzPrincipalVaultPda,
        revenueVault: fuzzRevenueVaultPda,
        treasury: fuzzTreasuryPda,
        vaultShareMint: fuzzVaultShareMintPda,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([fuzzOwner])
      .rpc();

    // Setup share ATAs for users
    for (let i = 0; i < NUM_USERS; i++) {
      const userShareAta = await anchor.utils.token.associatedAddress({
        mint: fuzzVaultShareMintPda,
        owner: fuzzUsers[i].publicKey
      });
      fuzzUserShareAtas.push(userShareAta);
    }
  });

  it("FUZZ: 100 random operations maintain all invariants", async () => {
    let mintedUsers = new Set<number>(); // Track which users have minted
    
    for (let op = 0; op < NUM_OPERATIONS; op++) {
      const operation = randomInt(0, 3);
      const userIdx = randomInt(0, NUM_USERS - 1);
      const user = fuzzUsers[userIdx];

      try {
        switch (operation) {
          case 0: // mint_shares
            if (!mintedUsers.has(userIdx)) {
              const amount = randomInt(1, 100);
              await program.methods
                .mintShares(new anchor.BN(amount))
                .accounts({
                  vault: fuzzVaultPda,
                  vaultSigner: fuzzVaultSignerPda,
                  payer: user.publicKey,
                  payerAta: fuzzUserAtas[userIdx],
                  principalVault: fuzzPrincipalVaultPda,
                  revenueVault: fuzzRevenueVaultPda,
                  vaultShareMint: fuzzVaultShareMintPda,
                  shareholder: fuzzUserShareholderPdas[userIdx],
                  investorShareAta: fuzzUserShareAtas[userIdx],
                  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                  tokenProgram: TOKEN_PROGRAM_ID,
                  systemProgram: SystemProgram.programId,
                })
                .signers([user])
                .rpc();
              mintedUsers.add(userIdx);
            } else {
              // Already minted, try adding more shares
              const amount = randomInt(1, 10);
              await program.methods
                .mintShares(new anchor.BN(amount))
                .accounts({
                  vault: fuzzVaultPda,
                  vaultSigner: fuzzVaultSignerPda,
                  payer: user.publicKey,
                  payerAta: fuzzUserAtas[userIdx],
                  principalVault: fuzzPrincipalVaultPda,
                  revenueVault: fuzzRevenueVaultPda,
                  vaultShareMint: fuzzVaultShareMintPda,
                  shareholder: fuzzUserShareholderPdas[userIdx],
                  investorShareAta: fuzzUserShareAtas[userIdx],
                  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                  tokenProgram: TOKEN_PROGRAM_ID,
                  systemProgram: SystemProgram.programId,
                })
                .signers([user])
                .rpc();
            }
            break;

          case 1: // deposit_revenue
            const vault = await program.account.vault.fetch(fuzzVaultPda);
            if (vault.mintedShares.gt(new anchor.BN(0))) {
              const revenueAmount = randomInt(1, 10000);
              await program.methods
                .depositRevenue(new anchor.BN(revenueAmount))
                .accounts({
                  vault: fuzzVaultPda,
                  payer: (payer as anchor.Wallet).publicKey,
                  payerAta: depositorAta,
                  revenueVault: fuzzRevenueVaultPda,
                  treasury: fuzzTreasuryPda,
                  vaultSigner: fuzzVaultSignerPda,
                  tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([(payer as anchor.Wallet).payer])
                .rpc();
            }
            break;

          case 2: // harvest
            if (mintedUsers.has(userIdx)) {
              await program.methods
                .harvest()
                .accounts({
                  vault: fuzzVaultPda,
                  vaultSigner: fuzzVaultSignerPda,
                  payer: user.publicKey,
                  shareholder: fuzzUserShareholderPdas[userIdx],
                  revenueVault: fuzzRevenueVaultPda,
                  userAta: fuzzUserAtas[userIdx],
                  tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([user])
                .rpc();
            }
            break;

          case 3: // redeem_shares
            if (mintedUsers.has(userIdx)) {
              try {
                const shareholder = await program.account.userStake.fetch(fuzzUserShareholderPdas[userIdx]);
                if (shareholder.quantity.gt(new anchor.BN(0))) {
                  const redeemAmount = randomInt(1, Math.min(shareholder.quantity.toNumber(), 10));
                  await program.methods
                    .redeemShares(new anchor.BN(redeemAmount))
                    .accounts({
                      vault: fuzzVaultPda,
                      vaultSigner: fuzzVaultSignerPda,
                      payer: user.publicKey,
                      shareholder: fuzzUserShareholderPdas[userIdx],
                      principalVault: fuzzPrincipalVaultPda,
                      revenueVault: fuzzRevenueVaultPda,
                      investorShareAta: fuzzUserShareAtas[userIdx],
                      vaultShareMint: fuzzVaultShareMintPda,
                      payerAta: fuzzUserAtas[userIdx],
                      tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([user])
                    .rpc();
                }
              } catch (e) {
                // Shareholder may not exist or have 0 shares, skip
              }
            }
            break;
        }
      } catch (e) {
        // Some operations may fail legitimately (e.g., insufficient balance)
        // That's fine for fuzz testing - we just verify invariants hold
      }

      // Assert invariants after every 10 operations
      if ((op + 1) % 10 === 0) {
        await assertAllInvariants();
      }
    }

    // Final invariant check
    await assertAllInvariants();
  }, 120000); // 2 minute timeout for fuzz test
});