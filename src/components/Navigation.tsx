"use client"
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Link from 'next/link';
import { WalletButton } from './providers/solana-provider';

const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);

    const navLinks = [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Docs", href: "https://github.com/abhyuday911/Anchor_farm-tokenization_cyberpunk", external: true },
        { label: "Explorer", href: "https://explorer.solana.com/?cluster=devnet", external: true },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-14">
                    {/* Logo - clean, no gradient */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-sm">YI</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground hidden sm:block">
                            Yield Infrastructure
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                target={link.external ? "_blank" : undefined}
                                rel={link.external ? "noopener noreferrer" : undefined}
                                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            >
                                {link.label}
                                {link.external && <ExternalLink className="w-3 h-3" />}
                            </Link>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="hidden md:flex items-center gap-3">
                        <WalletButton />
                        <Link href='/create-vault'>
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                Create Vault
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Menu */}
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild className="md:hidden">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Menu className="w-5 h-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[280px] bg-background border-border">
                            <div className="flex flex-col gap-1 mt-8">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        target={link.external ? "_blank" : undefined}
                                        rel={link.external ? "noopener noreferrer" : undefined}
                                        onClick={() => setIsOpen(false)}
                                        className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors flex items-center justify-between"
                                    >
                                        {link.label}
                                        {link.external && <ExternalLink className="w-3 h-3" />}
                                    </Link>
                                ))}
                                <div className="border-t border-border my-4" />
                                <div className="flex flex-col gap-3 px-3">
                                    <WalletButton />
                                    <Link href="/create-vault" onClick={() => setIsOpen(false)}>
                                        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                                            Create Vault
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;