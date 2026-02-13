"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldOff,
  Loader2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type GovernanceState = "active" | "immutable" | "loading" | "error";

interface GovernanceStatusBadgeProps {
  vaultPda: string;
  authorityAddress?: string;
  className?: string;
  showTooltip?: boolean;
}

export function GovernanceStatusBadge({
  vaultPda,
  authorityAddress,
  className,
  showTooltip = true,
}: GovernanceStatusBadgeProps) {
  const { connection } = useConnection();
  const [state, setState] = useState<GovernanceState>("loading");
  const [authority, setAuthority] = useState<string | null>(authorityAddress || null);

  useEffect(() => {
    // If authority is provided, use it directly
    if (authorityAddress) {
      const isRevoked = authorityAddress === PublicKey.default.toBase58();
      setState(isRevoked ? "immutable" : "active");
      setAuthority(authorityAddress);
      return;
    }

    // Otherwise, fetch from chain
    async function checkGovernance() {
      try {
        setState("loading");
        
        // Fetch vault account and parse authority
        // In production, use Anchor Program to deserialize
        const accountInfo = await connection.getAccountInfo(new PublicKey(vaultPda));
        
        if (!accountInfo) {
          setState("error");
          return;
        }

        // Authority is at offset 8 (discriminator) + 32 (owner) = 40
        // This is a simplified example - actual offset depends on struct layout
        const authorityBytes = accountInfo.data.slice(40, 72);
        const authorityPubkey = new PublicKey(authorityBytes);
        
        setAuthority(authorityPubkey.toBase58());
        setState(authorityPubkey.equals(PublicKey.default) ? "immutable" : "active");
      } catch (err) {
        setState("error");
      }
    }

    checkGovernance();
    
    // Poll every 60 seconds
    const interval = setInterval(checkGovernance, 60000);
    return () => clearInterval(interval);
  }, [connection, vaultPda, authorityAddress]);

  const BadgeContent = () => {
    switch (state) {
      case "loading":
        return (
          <Badge variant="outline" className={cn("gap-1", className)}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking...
          </Badge>
        );
      
      case "immutable":
        return (
          <Badge 
            variant="default" 
            className={cn("gap-1 bg-green-500 hover:bg-green-600 text-white", className)}
          >
            <ShieldCheck className="h-3 w-3" />
            Immutable
          </Badge>
        );
      
      case "active":
        return (
          <Badge 
            variant="outline" 
            className={cn("gap-1 border-yellow-500 text-yellow-500", className)}
          >
            <ShieldAlert className="h-3 w-3" />
            Active Governance
          </Badge>
        );
      
      case "error":
        return (
          <Badge 
            variant="destructive" 
            className={cn("gap-1", className)}
          >
            <ShieldOff className="h-3 w-3" />
            Unknown
          </Badge>
        );
    }
  };

  if (!showTooltip) {
    return <BadgeContent />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            <BadgeContent />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {state === "immutable" ? (
            <div className="space-y-1">
              <p className="font-semibold text-green-500">🔒 Protocol is Immutable</p>
              <p className="text-xs">
                Governance authority has been permanently revoked. 
                No fee changes, treasury redirects, or authority transfers are possible.
              </p>
            </div>
          ) : state === "active" ? (
            <div className="space-y-1">
              <p className="font-semibold text-yellow-500">⚡ Governance is Active</p>
              <p className="text-xs">
                Authority: {authority?.slice(0, 8)}...{authority?.slice(-8)}
              </p>
              <p className="text-xs text-muted-foreground">
                The authority can modify fees, update treasury, 
                or transfer/revoke governance.
              </p>
            </div>
          ) : state === "error" ? (
            <p className="text-xs">Unable to fetch governance status</p>
          ) : (
            <p className="text-xs">Checking governance status...</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default GovernanceStatusBadge;
