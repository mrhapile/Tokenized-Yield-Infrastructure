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
      .initializeVault("Ramesh Vault", new anchor.BN(10_000_000_000), new anchor.BN(100))
      .accounts({
        owner: vaultOwnerPubKey,
        vault: vaultPda,
        vaultSigner: vaultSignerPda,
        paymentMint,
        principalVault: principalVaultPda,
        revenueVault: revenueVaultPda,
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
      revenueVault: revenueVaultPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
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
      revenueVault: revenueVaultPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
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
        revenueVault: revenueVaultPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
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
          revenueVault: revenueVaultPda, vaultSigner: vaultSignerPda, tokenProgram: TOKEN_PROGRAM_ID,
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