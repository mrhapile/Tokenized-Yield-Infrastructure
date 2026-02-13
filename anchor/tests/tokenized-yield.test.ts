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
      .initializeVault("Ramesh Vault", new anchor.BN(1_000_000), new anchor.BN(100))
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
});
