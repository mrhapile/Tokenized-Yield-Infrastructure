// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
// import TokenizedYieldIDL from '../target/idl/tokenized_yield_infrastructure.json'
// import type { TokenizedYieldInfrastructure } from '../target/types/tokenized_yield_infrastructure'

// Temporary stub since IDL generation failed in this environment
export const TokenizedYieldIDL = {};
export type TokenizedYieldInfrastructure = any;

// Re-export the generated IDL and type


// The programId is imported from the program IDL.
export const PROGRAM_ID = new PublicKey("HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j")

// This is a helper function to get the Anchor program.
export function getProgram(provider: AnchorProvider, address?: PublicKey): Program<TokenizedYieldInfrastructure> {
  return new Program(TokenizedYieldIDL as any, provider)
}

// This is a helper function to get the program ID depending on the cluster.
export function getProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      return new PublicKey('HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j')
    case 'mainnet-beta':
    default:
      return PROGRAM_ID
  }
}
