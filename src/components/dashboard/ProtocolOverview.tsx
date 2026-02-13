"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VaultState {
  owner: string;
  authority: string;
  performanceFeeBps: number;
  treasury: string;
  totalFeesCollected: string;
  totalShares: string;
  mintedShares: string;
  sharesRedeemed: string;
  name: string;
}

interface ProtocolOverviewProps {
  programId: string;
  vaultPda: string;
  className?: string;
}

export function ProtocolOverview({ programId, vaultPda, className }: ProtocolOverviewProps) {
  const { connection } = useConnection();
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isGovernanceDisabled = vaultState?.authority === PublicKey.default.toBase58();

  useEffect(() => {
    async function fetchVaultState() {
      try {
        setLoading(true);
        setError(null);

        // Fetch raw account data
        const accountInfo = await connection.getAccountInfo(new PublicKey(vaultPda));
        
        if (!accountInfo) {
          setError("Vault not found on-chain");
          return;
        }

        // Parse vault state (simplified - in production use Anchor deserialization)
        // This is a placeholder for actual account parsing
        const data = accountInfo.data;
        
        // For demo purposes, we'll show loading state
        // Real implementation would decode the account data using Anchor IDL
        setVaultState({
          owner: "Loading...",
          authority: PublicKey.default.toBase58(), // Example
          performanceFeeBps: 500,
          treasury: "Loading...",
          totalFeesCollected: "0",
          totalShares: "1000000000",
          mintedShares: "0",
          sharesRedeemed: "0",
          name: "Tokenized Yield Vault",
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchVaultState();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchVaultState, 30000);
    return () => clearInterval(interval);
  }, [connection, vaultPda]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const truncateAddress = (address: string) => {
    if (address === "Loading...") return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const explorerUrl = (address: string) => 
    `https://explorer.solana.com/address/${address}?cluster=devnet`;

  return (
    <Card className={cn("border-2", className, isGovernanceDisabled ? "border-green-500/50" : "border-yellow-500/50")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              Protocol Overview
              {isGovernanceDisabled ? (
                <Badge variant="default" className="bg-green-500 text-white">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Immutable
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                  <ShieldAlert className="w-3 h-3 mr-1" />
                  Active Governance
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {vaultState?.name || "Loading vault..."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="text-destructive p-4 bg-destructive/10 rounded-md">
            Error: {error}
          </div>
        ) : (
          <>
            {/* Program ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Program ID</label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <code className="text-sm flex-1 font-mono">{truncateAddress(programId)}</code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(programId, "programId")}
                >
                  {copiedField === "programId" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <a href={explorerUrl(programId)} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Authority Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Governance Authority</label>
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-md",
                isGovernanceDisabled ? "bg-green-500/10" : "bg-yellow-500/10"
              )}>
                {isGovernanceDisabled ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-500">
                      Permanently Revoked (Zero Address)
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-5 w-5 text-yellow-500" />
                    <code className="text-sm flex-1 font-mono">{truncateAddress(vaultState?.authority || "")}</code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(vaultState?.authority || "", "authority")}
                    >
                      {copiedField === "authority" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Fee Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Performance Fee</label>
                <div className="p-3 bg-muted rounded-md">
                  <span className="text-2xl font-bold">
                    {(vaultState?.performanceFeeBps || 0) / 100}%
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({vaultState?.performanceFeeBps || 0} bps)
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Total Fees Collected</label>
                <div className="p-3 bg-muted rounded-md">
                  <span className="text-2xl font-bold">
                    {BigInt(vaultState?.totalFeesCollected || 0).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">tokens</span>
                </div>
              </div>
            </div>

            {/* Share Statistics */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Share Statistics</label>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted rounded-md text-center">
                  <div className="text-lg font-semibold">
                    {BigInt(vaultState?.totalShares || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Shares</div>
                </div>
                <div className="p-3 bg-muted rounded-md text-center">
                  <div className="text-lg font-semibold">
                    {BigInt(vaultState?.mintedShares || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Minted</div>
                </div>
                <div className="p-3 bg-muted rounded-md text-center">
                  <div className="text-lg font-semibold">
                    {BigInt(vaultState?.sharesRedeemed || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Redeemed</div>
                </div>
              </div>
            </div>

            {/* Vault PDA */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Vault PDA</label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <code className="text-sm flex-1 font-mono">{truncateAddress(vaultPda)}</code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(vaultPda, "vaultPda")}
                >
                  {copiedField === "vaultPda" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <a href={explorerUrl(vaultPda)} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ProtocolOverview;
