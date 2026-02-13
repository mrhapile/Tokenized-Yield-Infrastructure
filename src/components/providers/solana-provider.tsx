"use client";

import React, { FC, ReactNode, useMemo } from "react";
import {
    ConnectionProvider,
    WalletProvider
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    CoinbaseWalletAdapter,
    LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import dynamic from 'next/dynamic';

// Dynamic import wallet button to prevent SSR hydration conflicts
export const WalletButton = dynamic(
    async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton, 
    { ssr: false }
);

interface SolanaProviderProps {
    children: ReactNode;
}

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
    // Network from environment variable
    const networkEnv = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
    const network = networkEnv === "mainnet-beta" 
        ? WalletAdapterNetwork.Mainnet 
        : WalletAdapterNetwork.Devnet;

    // RPC endpoint from environment variable or fallback to cluster API
    const endpoint = useMemo(() => {
        const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
        if (customRpc && customRpc !== "") {
            return customRpc;
        }
        return clusterApiUrl(network);
    }, [network]);

    // Explicitly register wallet adapters
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new CoinbaseWalletAdapter(),
            new LedgerWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};