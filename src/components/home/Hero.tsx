"use client"

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Activity, Wallet, TrendingUp, Layers } from "lucide-react";
import Link from 'next/link';

// Protocol metrics - will be live data in production
const protocolMetrics = [
    { 
        label: "Total Principal Locked", 
        value: "0.00", 
        unit: "SOL",
        icon: Wallet,
        change: null 
    },
    { 
        label: "Protocol Revenue", 
        value: "0.00", 
        unit: "SOL",
        icon: TrendingUp,
        change: null 
    },
    { 
        label: "Treasury Balance", 
        value: "0.00", 
        unit: "SOL",
        icon: Layers,
        change: null 
    },
    { 
        label: "Active Vaults", 
        value: "0", 
        unit: "",
        icon: Activity,
        change: null 
    },
];

const Hero = () => {
    return (
        <section className="min-h-screen flex items-center pt-14 pb-16 bg-background">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Left: Title and Description */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-xs font-medium text-primary">Devnet</span>
                            </div>
                            
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight">
                                On-Chain Capital
                                <br />
                                <span className="text-muted-foreground">Infrastructure</span>
                            </h1>
                            
                            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                                Tokenize ownership, automate revenue distribution, and maintain 
                                audit-ready transaction flows. Built for institutional compliance.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link href='/create-vault'>
                                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                    Create Vault
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                            <Link href='/dashboard'>
                                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary">
                                    View Dashboard
                                </Button>
                            </Link>
                        </div>

                        {/* Quick Info */}
                        <div className="pt-6 border-t border-border">
                            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    Solana Program
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                    Anchor Framework
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                    Open Source
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Protocol Metrics Terminal */}
                    <div className="lg:pl-8">
                        <Card className="bg-card border-border overflow-hidden">
                            {/* Terminal Header */}
                            <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-500/60" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                                        <div className="w-3 h-3 rounded-full bg-green-500/60" />
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground ml-2">
                                        protocol_status.sol
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    <span className="text-xs text-muted-foreground">Live</span>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="p-4 space-y-1">
                                {protocolMetrics.map((metric) => (
                                    <div 
                                        key={metric.label}
                                        className="flex items-center justify-between py-3 px-3 rounded-md hover:bg-secondary/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <metric.icon className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">
                                                {metric.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-mono font-medium text-foreground">
                                                {metric.value}
                                            </span>
                                            {metric.unit && (
                                                <span className="text-sm text-muted-foreground">
                                                    {metric.unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t border-border bg-secondary/30">
                                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                                    <span>Program: HZFSmaks...fs9A3j</span>
                                    <span>Solana Devnet</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;