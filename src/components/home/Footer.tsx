import { Sprout, Github, X, UserRoundSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Footer = () => {
    const footerLinks = {
        Product: [
            { label: "Features", href: "#features" },
            { label: "Tokenization", href: "#" },
            { label: "Marketplace", href: "#" },
            { label: "Staking", href: "#" },
        ],
        Resources: [
            { label: "Documentation", href: "#" },
            { label: "Whitepaper", href: "#" },
            { label: "Blog", href: "#" },
            { label: "Support", href: "#" },
        ],
        Company: [
            { label: "About Us", href: "#" },
            { label: "Careers", href: "#" },
            { label: "Press Kit", href: "#" },
            { label: "Contact", href: "#" },
        ],
        Legal: [
            { label: "Terms of Service", href: "#" },
            { label: "Privacy Policy", href: "#" },
            { label: "Cookie Policy", href: "#" },
        ],
    };

    const socialLinks = [
        { name: "Twitter/X", icon: X, url: "https://x.com/rust2045", color: "hover:text-[#1DA1F2]" },
        { name: "GitHub", icon: Github, url: "https://github.com/abhyuday911", color: "hover:text-foreground" },
        { name: "Discord", icon: UserRoundSearch, url: "https://www.abhyuday.dev/", color: "hover:text-[#5865F2]" },
    ];

    return (
        <footer className="bg-secondary/25 border-t border-border">
            <div className="container mx-auto px-4 py-12 md:py-10 md:pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-12 mb-8">
                    <div className="sm:col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-12 h-12 rounded-lg bg-gradient-hero flex items-center justify-center">
                                <Sprout className="w-7 h-7 text-primary-foreground" />
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                                Yield Infrastructure
                            </span>
                        </div>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            On-Chain Share Issuance & Revenue Distribution Engine.
                            Tokenize ownership, automate dividends, and audit flows.
                        </p>

                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground">Stay Updated</h4>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    type="email"
                                    placeholder="Enter your email"
                                    className="bg-background border-border flex-1"
                                />
                                <Button className="bg-gradient-hero text-primary-foreground hover:opacity-90 flex-shrink-0">
                                    Subscribe
                                </Button>
                            </div>
                        </div>
                    </div>

                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category}>
                            <h3 className="font-bold mb-4 text-foreground text-sm uppercase tracking-wider last:bg-amber-400">
                                {category}
                            </h3>
                            <ul className="space-y-3">
                                {links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-primary transition-colors inline-block"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-border">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-sm text-muted-foreground text-center md:text-left">
                            © 2025 Tokenized Yield Infrastructure. All rights reserved. Built with blockchain technology for transparent finance.
                        </p>

                        <div className="flex items-center gap-3">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.name}
                                    href={social.url}
                                    className={`w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground transition-all hover:border-primary ${social.color}`}
                                    aria-label={social.name}
                                >
                                    <social.icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;