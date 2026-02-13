"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { 
  ProtocolOverview, 
  CapitalSegregation, 
  InvariantMonitor, 
  EventTimeline,
  GovernanceStatusBadge 
} from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  RefreshCw, 
  ExternalLink,
  Network,
  Wifi,
  WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import Navigation from "@/components/Navigation";

// Protocol Constants (from deployment)
const PROGRAM_ID = "HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j";

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

export default function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [network, setNetwork] = useState<"devnet" | "mainnet-beta">("devnet");
  const [isOnline, setIsOnline] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [pdas, setPdas] = useState<ReturnType<typeof deriveVaultPDAs> | null>(null);

  // Initialize lastRefresh on client only (prevents hydration mismatch)
  useEffect(() => {
    setLastRefresh(new Date());
  }, []);

  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await connection.getSlot();
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [connection]);

  // Derive PDAs when wallet connects
  useEffect(() => {
    if (publicKey) {
      const derivedPdas = deriveVaultPDAs(publicKey, new PublicKey(PROGRAM_ID));
      setPdas(derivedPdas);
    } else {
      setPdas(null);
    }
  }, [publicKey]);

  const handleRefresh = () => {
    setLastRefresh(new Date());
    // Trigger re-render of child components
    window.dispatchEvent(new CustomEvent("dashboard-refresh"));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Header */}
      <header className="sticky top-16 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Institutional Dashboard</h1>
            <GovernanceStatusBadge 
              vaultPda={pdas?.vaultPda.toBase58() || PublicKey.default.toBase58()}
            />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Network Status */}
            <Badge 
              variant={isOnline ? "outline" : "destructive"} 
              className={cn(
                "gap-1",
                isOnline ? "border-green-500 text-green-500" : ""
              )}
            >
              {isOnline ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {network}
            </Badge>

            {/* Refresh */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            {/* Explorer Link */}
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${network}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-4 w-4" />
                Explorer
              </Button>
            </a>

            {/* Wallet */}
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {!connected ? (
          // Not Connected State
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Settings className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Connect your Solana wallet to view the institutional dashboard 
              for your vault deployment.
            </p>
            <WalletMultiButton />
          </div>
        ) : !pdas ? (
          // Loading PDAs
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          // Dashboard Grid
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Protocol Overview - Full Width on mobile, half on desktop */}
            <div className="lg:col-span-1">
              <ProtocolOverview
                programId={PROGRAM_ID}
                vaultPda={pdas.vaultPda.toBase58()}
                className="h-full"
              />
            </div>

            {/* Capital Segregation */}
            <div className="lg:col-span-1">
              <CapitalSegregation
                vaultPda={pdas.vaultPda.toBase58()}
                principalVaultPda={pdas.principalVaultPda.toBase58()}
                revenueVaultPda={pdas.revenueVaultPda.toBase58()}
                treasuryPda={pdas.treasuryPda.toBase58()}
                className="h-full"
              />
            </div>

            {/* Invariant Monitor - Full Width */}
            <div className="lg:col-span-2">
              <InvariantMonitor
                programId={PROGRAM_ID}
                vaultPda={pdas.vaultPda.toBase58()}
                principalVaultPda={pdas.principalVaultPda.toBase58()}
                revenueVaultPda={pdas.revenueVaultPda.toBase58()}
                treasuryPda={pdas.treasuryPda.toBase58()}
              />
            </div>

            {/* Event Timeline - Full Width */}
            <div className="lg:col-span-2">
              <EventTimeline
                vaultPda={pdas.vaultPda.toBase58()}
                limit={25}
              />
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
          {lastRefresh && (
            <p>
              Last refreshed: {lastRefresh.toLocaleTimeString()} | 
              Program ID: <code className="font-mono">{PROGRAM_ID.slice(0, 8)}...{PROGRAM_ID.slice(-8)}</code>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
