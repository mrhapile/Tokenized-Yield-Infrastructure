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
  let paymentVaultPda: PublicKey;
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

    [paymentVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("payment-vault"), vaultPda.toBuffer()],
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
        paymentVault: paymentVaultPda,
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
    expect(vaultAccount.totalShares.toNumber()).toBe(1_000_000);
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
        paymentVault: paymentVaultPda,
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
    expect(shareholder.quantity).toBe(500);
    // vault field is public key
    expect(shareholder.vault.toString()).toBe(vaultPda.toString());
  });

  it("fails if amount == 0", async () => {
    // derive ATA
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
        paymentVault: paymentVaultPda,
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
    // Mint enough payment tokens to buy > u32 max shares
    await mintTo(
      provider.connection,
      (payer as anchor.Wallet).payer,
      paymentMint,
      buyerPaymentAta,
      vaultOwnerPubKey,
      500_000_000_000
    );

    const amount = new anchor.BN(4_500_000_000); // > 2^32

    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
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
        paymentVault: paymentVaultPda,
        vaultShareMint: vaultShareMintPda,
        shareholder: shareholderPda,
        investorShareAta: investorShareAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const shareholder = await program.account.userStake.fetch(shareholderPda);
    // Previous 500 + 4,500,000,000 = 4,500,000,500
    expect(shareholder.quantity.toString()).toBe("4500000500");
  });

  it("fails with invalid payment mint", async () => {
    const fakeMint = await createMint(
      provider.connection,
      (payer as anchor.Wallet).payer,
      vaultOwnerPubKey,
      null,
      6
    );
    const fakeAta = await createAccount(
      provider.connection,
      (payer as anchor.Wallet).payer,
      fakeMint,
      buyer.publicKey
    );

    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });

    const tx = program.methods
      .mintShares(new anchor.BN(10))
      .accounts({
        vault: vaultPda,
        vaultSigner: vaultSignerPda,
        payer: buyer.publicKey,
        payerAta: fakeAta,
        paymentVault: paymentVaultPda,
        vaultShareMint: vaultShareMintPda,
        shareholder: shareholderPda,
        investorShareAta: investorShareAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer]);

    // Should fail due to constraint
    await expect(tx.rpc()).rejects.toThrow();
  });

  // --- INVARIANT HELPERS ---

  async function assertVaultInvariant() {
    const vaultAccount = await program.account.vault.fetch(vaultPda);
    const shareholders = await program.account.userStake.all([
      {
        memcmp: {
          offset: 8 + 1 + 32, // Discriminator + bool + owner
          bytes: vaultPda.toBase58(),
        },
      },
    ]);

    const totalUserShares = shareholders.reduce(
      (acc, s) => acc.add(new anchor.BN(s.account.quantity)),
      new anchor.BN(0)
    );

    expect(totalUserShares.toString()).toBe(vaultAccount.mintedShares.toString());
  }

  // --- FORMAL INVARIANTS TESTS ---

  it("INVARIANT: Supply Cap Enforcement", async () => {
    // Current minted is ~4.5B + 500. Total is 10B.
    // Try to mint 6B -> should fail (exceeds 10B)
    const amount = new anchor.BN(6_000_000_000);

    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });

    // Ensure buyer has enough payment tokens (mint more just in case)
    await mintTo(
      provider.connection,
      (payer as anchor.Wallet).payer,
      paymentMint,
      buyerPaymentAta,
      vaultOwnerPubKey,
      600_000_000_000 // 6B * 100
    );

    const tx = program.methods
      .mintShares(amount)
      .accounts({
        vault: vaultPda,
        vaultSigner: vaultSignerPda,
        payer: buyer.publicKey,
        payerAta: buyerPaymentAta,
        paymentVault: paymentVaultPda,
        vaultShareMint: vaultShareMintPda,
        shareholder: shareholderPda,
        investorShareAta: investorShareAta,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer]);

    await expect(tx.rpc()).rejects.toThrow("ExceedsTotalSupply");
    await assertVaultInvariant();
  });

  it("INVARIANT: Economic Integrity", async () => {
    const amount = new anchor.BN(100);
    const price = new anchor.BN(100);
    const expectedPayment = amount.mul(price);

    const startVaultBalance = (await provider.connection.getTokenAccountBalance(paymentVaultPda)).value.amount;

    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });

    await program.methods.mintShares(amount).accounts({
      vault: vaultPda,
      vaultSigner: vaultSignerPda,
      payer: buyer.publicKey,
      payerAta: buyerPaymentAta,
      paymentVault: paymentVaultPda,
      vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda,
      investorShareAta: investorShareAta,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([buyer]).rpc();

    const endVaultBalance = (await provider.connection.getTokenAccountBalance(paymentVaultPda)).value.amount;

    const diff = new anchor.BN(endVaultBalance).sub(new anchor.BN(startVaultBalance));
    expect(diff.toString()).toBe(expectedPayment.toString());
    await assertVaultInvariant();
  });

  it("INVARIANT: Shareholder Conservation", async () => {
    // Generate a new user to test multiple shareholders
    const buyer2 = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(buyer2.publicKey, 1e9)
    );
    const buyer2PaymentAta = await createAccount(
      provider.connection,
      (payer as anchor.Wallet).payer,
      paymentMint,
      buyer2.publicKey
    );
    await mintTo(
      provider.connection,
      (payer as anchor.Wallet).payer,
      paymentMint,
      buyer2PaymentAta,
      vaultOwnerPubKey,
      1_000_000
    );

    const amount = new anchor.BN(50);
    const [shareholder2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer2.publicKey.toBuffer()],
      program.programId
    );
    const investorShareAta2 = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer2.publicKey
    });

    await program.methods.mintShares(amount).accounts({
      vault: vaultPda,
      vaultSigner: vaultSignerPda,
      payer: buyer2.publicKey,
      payerAta: buyer2PaymentAta,
      paymentVault: paymentVaultPda,
      vaultShareMint: vaultShareMintPda,
      shareholder: shareholder2Pda,
      investorShareAta: investorShareAta2,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([buyer2]).rpc();

    await assertVaultInvariant(); // Checks sum(shareholders) == vault.minted
  });

  it("INVARIANT: Zero Amount Rejection", async () => {
    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });

    const tx = program.methods.mintShares(new anchor.BN(0)).accounts({
      vault: vaultPda,
      vaultSigner: vaultSignerPda,
      payer: buyer.publicKey,
      payerAta: buyerPaymentAta,
      paymentVault: paymentVaultPda,
      vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda,
      investorShareAta: investorShareAta,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([buyer]);

    await expect(tx.rpc()).rejects.toThrow("InvalidShareAmount");
  });

  it("INVARIANT: Overflow Boundary Test", async () => {
    // Attempt mint u64::MAX
    // This should fail either due to MathOverflow (price * amount > u64) 
    // or Total Supply or Overflow if we could somehow afford it.
    // Price is 100. u64::MAX / 100 is the max we can pay for.
    // Even if we have infinite money, u64::MAX shares + existing shares > u64::MAX (Overflow).

    // Let's pass a huge number
    const hugeAmount = new anchor.BN("18446744073709551615"); // u64 MAX

    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });

    const tx = program.methods.mintShares(hugeAmount).accounts({
      vault: vaultPda,
      vaultSigner: vaultSignerPda,
      payer: buyer.publicKey,
      payerAta: buyerPaymentAta,
      paymentVault: paymentVaultPda,
      vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda,
      investorShareAta: investorShareAta,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([buyer]);

    // Likely MathOverflow due to price calc, or Overflow due to add. 
    // Just expect an error.
    // Just expect an error.
    await expect(tx.rpc()).rejects.toThrow();
  });

  it("SECURITY: Unauthorized Payment Vault", async () => {
    // Create a fake payment vault not owned by vault_signer
    const fakePaymentVault = await createAccount(
      provider.connection,
      (payer as anchor.Wallet).payer,
      paymentMint,
      buyer.publicKey // Owned by buyer, not vault_signer
    );

    const [shareholderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("shareholder"), vaultPda.toBuffer(), buyer.publicKey.toBuffer()],
      program.programId
    );
    const investorShareAta = await anchor.utils.token.associatedAddress({
      mint: vaultShareMintPda,
      owner: buyer.publicKey
    });

    const tx = program.methods.mintShares(new anchor.BN(10)).accounts({
      vault: vaultPda,
      vaultSigner: vaultSignerPda,
      payer: buyer.publicKey,
      payerAta: buyerPaymentAta,
      paymentVault: fakePaymentVault, // Malicious account
      vaultShareMint: vaultShareMintPda,
      shareholder: shareholderPda,
      investorShareAta: investorShareAta,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([buyer]);

    await expect(tx.rpc()).rejects.toThrow("InvalidPaymentVault");
  });

});