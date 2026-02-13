import { Github, ExternalLink } from "lucide-react";

const Footer = () => {
    const footerLinks = {
        Protocol: [
            { label: "Documentation", href: "https://github.com/abhyuday911/Anchor_farm-tokenization_cyberpunk", external: true },
            { label: "GitHub", href: "https://github.com/abhyuday911/Anchor_farm-tokenization_cyberpunk", external: true },
            { label: "Program ID", href: "https://explorer.solana.com/address/HZFSmaksGBkhV1eFUbvnAmEj99yT5sKTcDQSMDfs9A3j?cluster=devnet", external: true },
        ],
        Network: [
            { label: "Solana Devnet", href: "https://explorer.solana.com/?cluster=devnet", external: true },
            { label: "RPC Status", href: "https://status.solana.com/", external: true },
        ],
        Resources: [
            { label: "Anchor Framework", href: "https://www.anchor-lang.com/", external: true },
            { label: "Solana Docs", href: "https://solana.com/docs", external: true },
        ],
    };

    return (
        <footer className="border-t border-border bg-background">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                                <span className="text-primary-foreground font-bold text-sm">YI</span>
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                                Yield Infrastructure
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            On-chain share issuance and revenue distribution protocol.
                        </p>
                        <a 
                            href="https://github.com/abhyuday911/Anchor_farm-tokenization_cyberpunk"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Github className="w-4 h-4" />
                            View on GitHub
                        </a>
                    </div>

                    {/* Links */}
                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category}>
                            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">
                                {category}
                            </h3>
                            <ul className="space-y-3">
                                {links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            target={link.external ? "_blank" : undefined}
                                            rel={link.external ? "noopener noreferrer" : undefined}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                                        >
                                            {link.label}
                                            {link.external && <ExternalLink className="w-3 h-3" />}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="mt-12 pt-6 border-t border-border">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-muted-foreground">
                            © {new Date().getFullYear()} Tokenized Yield Infrastructure. Open source under MIT license.
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Devnet
                            </span>
                            <span className="font-mono">
                                v0.1.0
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;