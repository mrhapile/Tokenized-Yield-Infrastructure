"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import dynamic from "next/dynamic";
import { 
  ProtocolOverview, 
  CapitalSegregation, 
  InvariantMonitor, 
  EventTimeline,
  GovernanceStatusBadge 
} from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Settings, 
  RefreshCw, 
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import Navigation from "@/components/Navigation";

// Dynamic import wallet button (SSR-safe)
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then(mod => mod.WalletMultiButton),
  { 
    ssr: false,
    loading: () => <Skeleton className="h-10 w-32" />
  }
);

// Protocol Constants from environment
const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID || "HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j";
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";

// PDA derivation helper
function deriveVaultPDAs(owner: PublicKey, programId: PublicKey) {
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    programId
  );

  const [principalVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("principal-vault"), vaultPda.toBuffer()],
    programId
  );

  const [revenueVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("revenue-vault"), vaultPda.toBuffer()],
    programId
  );

  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), vaultPda.toBuffer()],
    programId
  );

  return { vaultPda, principalVaultPda, revenueVaultPda, treasuryPda };
}

/**
 * DashboardClient - All blockchain logic is client-only
 * Server renders static shell, client hydrates with RPC data
 */
export default function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  
  // Client-only state (prevents SSR mismatch)
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [rpcLatency, setRpcLatency] = useState<number | null>(null);

  // Memoized PDA derivation
  const pdas = useMemo(() => {
    if (!publicKey) return null;
    return deriveVaultPDAs(publicKey, new PublicKey(PROGRAM_ID));
  }, [publicKey]);

  // Initialize client-only state after mount
  useEffect(() => {
    setMounted(true);
    setLastRefresh(new Date().toLocaleTimeString());
  }, []);

  // Check connection status (client-only)
  useEffect(() => {
    if (!mounted) return;

    const checkConnection = async () => {
      const start = performance.now();
      try {
        const slot = await connection.getSlot();
        const latency = Math.round(performance.now() - start);
        setIsOnline(true);
        setCurrentSlot(slot);
        setRpcLatency(latency);
      } catch {
        setIsOnline(false);
        setCurrentSlot(null);
        setRpcLatency(null);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [connection, mounted]);

  const handleRefresh = () => {
    setLastRefresh(new Date().toLocaleTimeString());
    // Trigger re-render of child components
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    }
  };

  // Server renders static shell
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <header className="sticky top-14 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-12 items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </header>
        <main className="container py-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg lg:col-span-3" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Header - Compact */}
      <header className="sticky top-14 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-12 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
            {pdas && (
              <GovernanceStatusBadge 
                vaultPda={pdas.vaultPda.toBase58()}
              />
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Network Status - Compact */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary text-xs">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isOnline ? "bg-emerald-500" : isOnline === false ? "bg-red-500" : "bg-muted-foreground animate-pulse"
              )} />
              <span className="text-muted-foreground font-mono">{NETWORK}</span>
              {rpcLatency !== null && (
                <span className="text-muted-foreground/60">{rpcLatency}ms</span>
              )}
            </div>

            {/* Refresh */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Explorer Link */}
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${NETWORK}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>

            {/* Wallet (SSR-safe dynamic import) */}
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {!connected ? (
          // Compact Connect Wallet Card
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-sm">
              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Connect Wallet
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Connect your Solana wallet to view vault data and protocol metrics.
                </p>
                <WalletMultiButton />
                <p className="text-xs text-muted-foreground mt-4 font-mono">
                  Solana {NETWORK}
                </p>
              </div>
            </div>
          </div>
        ) : !pdas ? (
          // Loading PDAs
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          // Dashboard Grid - 3 Column Layout
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left Column - Protocol Overview */}
            <div className="lg:col-span-1">
              <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
                <ProtocolOverview
                  programId={PROGRAM_ID}
                  vaultPda={pdas.vaultPda.toBase58()}
                  className="h-full"
                />
              </Suspense>
            </div>

            {/* Center Column - Capital Segregation */}
            <div className="lg:col-span-1">
              <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
                <CapitalSegregation
                  vaultPda={pdas.vaultPda.toBase58()}
                  principalVaultPda={pdas.principalVaultPda.toBase58()}
                  revenueVaultPda={pdas.revenueVaultPda.toBase58()}
                  treasuryPda={pdas.treasuryPda.toBase58()}
                  className="h-full"
                />
              </Suspense>
            </div>

            {/* Right Column - Event Timeline Preview */}
            <div className="lg:col-span-1">
              <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
                <EventTimeline
                  vaultPda={pdas.vaultPda.toBase58()}
                  limit={8}
                />
              </Suspense>
            </div>

            {/* Full Width - Invariant Monitor */}
            <div className="lg:col-span-3">
              <Suspense fallback={<Skeleton className="h-48 w-full rounded-lg" />}>
                <InvariantMonitor
                  programId={PROGRAM_ID}
                  vaultPda={pdas.vaultPda.toBase58()}
                  principalVaultPda={pdas.principalVaultPda.toBase58()}
                  revenueVaultPda={pdas.revenueVaultPda.toBase58()}
                  treasuryPda={pdas.treasuryPda.toBase58()}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* Footer Info - Minimal */}
        {connected && lastRefresh && (
          <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground font-mono">
            <div className="flex items-center justify-between">
              <span>Last refresh: {lastRefresh}</span>
              <span>
                {currentSlot && `Slot ${currentSlot.toLocaleString()} • `}
                {PROGRAM_ID.slice(0, 4)}...{PROGRAM_ID.slice(-4)}
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
