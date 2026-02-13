"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from "@solana/web3.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  ExternalLink,
  Loader2,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EventEntry {
  signature: string;
  timestamp: Date | null;
  slot: number;
  type: "deposit" | "withdraw" | "revenue" | "harvest" | "governance" | "unknown";
  status: "success" | "failed";
  memo?: string;
}

interface EventTimelineProps {
  vaultPda: string;
  className?: string;
  limit?: number;
}

export function EventTimeline({
  vaultPda,
  className,
  limit = 20,
}: EventTimelineProps) {
  const { connection } = useConnection();
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [hasMore, setHasMore] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch signatures for the vault PDA
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(vaultPda),
        { limit: limit + 1 }
      );

      setHasMore(signatures.length > limit);
      const trimmedSignatures = signatures.slice(0, limit);

      // Map signatures to event entries
      const eventList: EventEntry[] = trimmedSignatures.map((sig) => ({
        signature: sig.signature,
        timestamp: sig.blockTime ? new Date(sig.blockTime * 1000) : null,
        slot: sig.slot,
        type: inferEventType(sig.memo),
        status: sig.err ? "failed" : "success",
        memo: sig.memo || undefined,
      }));

      setEvents(eventList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connection, vaultPda, limit]);

  useEffect(() => {
    fetchEvents();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const inferEventType = (memo: string | null | undefined): EventEntry["type"] => {
    if (!memo) return "unknown";
    const m = memo.toLowerCase();
    if (m.includes("deposit") || m.includes("buy")) return "deposit";
    if (m.includes("withdraw") || m.includes("redeem")) return "withdraw";
    if (m.includes("revenue")) return "revenue";
    if (m.includes("harvest") || m.includes("claim")) return "harvest";
    if (m.includes("governance") || m.includes("authority") || m.includes("fee")) return "governance";
    return "unknown";
  };

  const getEventIcon = (type: EventEntry["type"]) => {
    switch (type) {
      case "deposit": return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case "withdraw": return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "revenue": return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
      case "harvest": return <ArrowUpRight className="h-4 w-4 text-purple-500" />;
      case "governance": return <Filter className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventColor = (type: EventEntry["type"]) => {
    switch (type) {
      case "deposit": return "bg-green-500/10 border-green-500/20 text-green-500";
      case "withdraw": return "bg-red-500/10 border-red-500/20 text-red-500";
      case "revenue": return "bg-blue-500/10 border-blue-500/20 text-blue-500";
      case "harvest": return "bg-purple-500/10 border-purple-500/20 text-purple-500";
      case "governance": return "bg-orange-500/10 border-orange-500/20 text-orange-500";
      default: return "bg-muted border-muted-foreground/20 text-muted-foreground";
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "Pending...";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const truncateSignature = (sig: string) => `${sig.slice(0, 8)}...${sig.slice(-8)}`;

  const explorerUrl = (sig: string) => 
    `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

  const filteredEvents = filter === "all" 
    ? events 
    : events.filter(e => e.type === filter);

  const eventTypes: EventEntry["type"][] = ["deposit", "withdraw", "revenue", "harvest", "governance", "unknown"];

  return (
    <Card className={cn("border-2", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              Event Timeline
              <Badge variant="outline" className="ml-2">
                {events.length} events
              </Badge>
            </CardTitle>
            <CardDescription>
              Real-time transaction history for the vault
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchEvents}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          {eventTypes.map((type) => (
            <Button
              key={type}
              variant={filter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(type)}
              className={cn(filter !== type && getEventColor(type))}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-destructive p-4 bg-destructive/10 rounded-md">
            Error: {error}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {filter === "all" 
              ? "No transactions found for this vault"
              : `No ${filter} transactions found`}
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
              
              {/* Events */}
              <div className="space-y-3">
                {filteredEvents.map((event, index) => (
                  <div 
                    key={event.signature}
                    className="relative flex gap-3 pl-1"
                  >
                    {/* Timeline dot */}
                    <div className={cn(
                      "relative z-10 p-2 rounded-full border-2 bg-background",
                      getEventColor(event.type)
                    )}>
                      {getEventIcon(event.type)}
                    </div>

                    {/* Event content */}
                    <div className={cn(
                      "flex-1 p-3 rounded-lg border",
                      event.status === "failed" ? "bg-red-500/5 border-red-500/20" : "bg-muted/50"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getEventColor(event.type))}
                          >
                            {event.type}
                          </Badge>
                          {event.status === "failed" && (
                            <Badge variant="destructive" className="text-xs">
                              Failed
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono text-muted-foreground">
                          {truncateSignature(event.signature)}
                        </code>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            Slot {event.slot.toLocaleString()}
                          </span>
                          <a 
                            href={explorerUrl(event.signature)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        </div>
                      </div>

                      {event.memo && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {event.memo}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Load more indicator */}
            {hasMore && (
              <div className="text-center pt-2">
                <span className="text-xs text-muted-foreground">
                  Showing {filteredEvents.length} of {hasMore ? "many" : events.length} events
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default EventTimeline;
