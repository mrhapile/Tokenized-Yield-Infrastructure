"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  Shield,
  Lock,
  Percent,
  Wallet,
  ArrowRightLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Invariant {
  id: string;
  name: string;
  description: string;
  category: "solvency" | "segregation" | "governance" | "math";
  check: () => Promise<boolean>;
  icon: React.ReactNode;
}

interface InvariantResult {
  id: string;
  passed: boolean;
  timestamp: Date;
  error?: string;
}

interface InvariantMonitorProps {
  programId: string;
  vaultPda: string;
  principalVaultPda: string;
  revenueVaultPda: string;
  treasuryPda: string;
  className?: string;
}

export function InvariantMonitor({
  programId,
  vaultPda,
  principalVaultPda,
  revenueVaultPda,
  treasuryPda,
  className,
}: InvariantMonitorProps) {
  const { connection } = useConnection();
  const [results, setResults] = useState<Map<string, InvariantResult>>(new Map());
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  // Define invariants
  const invariants: Invariant[] = [
    {
      id: "INV-1",
      name: "Program Ownership",
      description: "Vault is owned by the correct program",
      category: "governance",
      icon: <Shield className="h-4 w-4" />,
      check: async () => {
        const info = await connection.getAccountInfo(new PublicKey(vaultPda));
        return info?.owner.equals(new PublicKey(programId)) || false;
      },
    },
    {
      id: "INV-2",
      name: "Capital Segregation",
      description: "Principal, revenue, and treasury are separate accounts",
      category: "segregation",
      icon: <Wallet className="h-4 w-4" />,
      check: async () => {
        // Verify all PDAs are different
        const pdas = [principalVaultPda, revenueVaultPda, treasuryPda];
        const unique = new Set(pdas);
        return unique.size === 3;
      },
    },
    {
      id: "INV-3",
      name: "Principal Vault Exists",
      description: "Principal vault token account is initialized",
      category: "solvency",
      icon: <Lock className="h-4 w-4" />,
      check: async () => {
        try {
          const info = await connection.getAccountInfo(new PublicKey(principalVaultPda));
          return info !== null && info.data.length > 0;
        } catch {
          return false;
        }
      },
    },
    {
      id: "INV-4",
      name: "Revenue Vault Exists",
      description: "Revenue vault token account is initialized",
      category: "solvency",
      icon: <ArrowRightLeft className="h-4 w-4" />,
      check: async () => {
        try {
          const info = await connection.getAccountInfo(new PublicKey(revenueVaultPda));
          return info !== null && info.data.length > 0;
        } catch {
          return false;
        }
      },
    },
    {
      id: "INV-5",
      name: "Treasury Exists",
      description: "Treasury token account is initialized",
      category: "solvency",
      icon: <Percent className="h-4 w-4" />,
      check: async () => {
        try {
          const info = await connection.getAccountInfo(new PublicKey(treasuryPda));
          return info !== null && info.data.length > 0;
        } catch {
          return false;
        }
      },
    },
    {
      id: "INV-6",
      name: "PDA Derivation",
      description: "PDAs are correctly derived from vault",
      category: "math",
      icon: <Lock className="h-4 w-4" />,
      check: async () => {
        // Verify PDA derivation
        const [expectedPrincipal] = PublicKey.findProgramAddressSync(
          [Buffer.from("principal-vault"), new PublicKey(vaultPda).toBuffer()],
          new PublicKey(programId)
        );
        const [expectedRevenue] = PublicKey.findProgramAddressSync(
          [Buffer.from("revenue-vault"), new PublicKey(vaultPda).toBuffer()],
          new PublicKey(programId)
        );
        const [expectedTreasury] = PublicKey.findProgramAddressSync(
          [Buffer.from("treasury"), new PublicKey(vaultPda).toBuffer()],
          new PublicKey(programId)
        );
        
        return (
          expectedPrincipal.equals(new PublicKey(principalVaultPda)) &&
          expectedRevenue.equals(new PublicKey(revenueVaultPda)) &&
          expectedTreasury.equals(new PublicKey(treasuryPda))
        );
      },
    },
    {
      id: "INV-7",
      name: "Non-Zero Program",
      description: "Program ID is not the zero address",
      category: "governance",
      icon: <Shield className="h-4 w-4" />,
      check: async () => {
        return !new PublicKey(programId).equals(PublicKey.default);
      },
    },
    {
      id: "INV-8",
      name: "Vault State Valid",
      description: "Vault account has valid data",
      category: "solvency",
      icon: <CheckCircle2 className="h-4 w-4" />,
      check: async () => {
        try {
          const info = await connection.getAccountInfo(new PublicKey(vaultPda));
          // Minimum vault size check (discriminator + basic fields)
          return info !== null && info.data.length > 100;
        } catch {
          return false;
        }
      },
    },
  ];

  const runChecks = useCallback(async () => {
    setChecking(true);
    const newResults = new Map<string, InvariantResult>();

    for (const invariant of invariants) {
      try {
        const passed = await invariant.check();
        newResults.set(invariant.id, {
          id: invariant.id,
          passed,
          timestamp: new Date(),
        });
      } catch (err: any) {
        newResults.set(invariant.id, {
          id: invariant.id,
          passed: false,
          timestamp: new Date(),
          error: err.message,
        });
      }
    }

    setResults(newResults);
    setLastCheck(new Date());
    setChecking(false);
  }, [connection, invariants]);

  useEffect(() => {
    runChecks();
    
    // Run checks every 60 seconds
    const interval = setInterval(runChecks, 60000);
    return () => clearInterval(interval);
  }, [runChecks]);

  const passedCount = Array.from(results.values()).filter(r => r.passed).length;
  const failedCount = Array.from(results.values()).filter(r => !r.passed).length;
  const allPassed = failedCount === 0 && passedCount > 0;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "solvency": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "segregation": return "text-purple-500 bg-purple-500/10 border-purple-500/20";
      case "governance": return "text-green-500 bg-green-500/10 border-green-500/20";
      case "math": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      default: return "text-gray-500 bg-gray-500/10";
    }
  };

  return (
    <Card className={cn("border-2", className, allPassed ? "border-green-500/30" : "border-red-500/30")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              Invariant Monitor
              {allPassed ? (
                <Badge variant="default" className="bg-green-500 text-white">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  All Passing
                </Badge>
              ) : failedCount > 0 ? (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />
                  {failedCount} Failed
                </Badge>
              ) : (
                <Badge variant="outline">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Checking...
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Runtime verification of protocol invariants
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runChecks}
            disabled={checking}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", checking && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-3 bg-muted rounded-md text-center">
            <div className="text-2xl font-bold">{invariants.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-3 bg-green-500/10 rounded-md text-center">
            <div className="text-2xl font-bold text-green-500">{passedCount}</div>
            <div className="text-xs text-muted-foreground">Passed</div>
          </div>
          <div className="p-3 bg-red-500/10 rounded-md text-center">
            <div className="text-2xl font-bold text-red-500">{failedCount}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="p-3 bg-muted rounded-md text-center">
            <div className="text-2xl font-bold">{results.size === 0 ? "-" : "60s"}</div>
            <div className="text-xs text-muted-foreground">Interval</div>
          </div>
        </div>

        {/* Last check time */}
        {lastCheck && (
          <p className="text-xs text-muted-foreground text-center">
            Last checked: {lastCheck.toLocaleTimeString()}
          </p>
        )}

        {/* Invariant List */}
        <div className="space-y-2">
          {invariants.map((invariant) => {
            const result = results.get(invariant.id);
            const isPassed = result?.passed;
            const isError = result?.error;
            
            return (
              <div 
                key={invariant.id}
                className={cn(
                  "p-3 rounded-lg border flex items-center gap-3",
                  !result ? "bg-muted/50 border-muted" :
                  isPassed ? "bg-green-500/5 border-green-500/20" :
                  "bg-red-500/5 border-red-500/20"
                )}
              >
                <div className={cn(
                  "p-2 rounded-full",
                  getCategoryColor(invariant.category)
                )}>
                  {invariant.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {invariant.id}
                    </span>
                    <span className="font-medium truncate">{invariant.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {isError || invariant.description}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {!result ? (
                    <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                  ) : isPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Category Legend */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">Categories:</span>
          {["solvency", "segregation", "governance", "math"].map((cat) => (
            <Badge key={cat} variant="outline" className={cn("text-xs", getCategoryColor(cat))}>
              {cat}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default InvariantMonitor;
