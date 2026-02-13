import { Card } from "@/components/ui/card";
import { FileCode2, Coins, BarChart3, Shield } from "lucide-react";

const steps = [
    {
        step: "01",
        icon: FileCode2,
        title: "Initialize Vault",
        description: "Deploy a new vault with configurable parameters: share allocation, fee structure, and governance settings.",
        code: "initialize_vault(config)",
    },
    {
        step: "02",
        icon: Coins,
        title: "Issue Shares",
        description: "Mint SPL tokens representing fractional ownership. Each share class has distinct rights and distribution ratios.",
        code: "issue_shares(amount, class)",
    },
    {
        step: "03",
        icon: BarChart3,
        title: "Distribute Yield",
        description: "Revenue flows are automatically distributed to shareholders pro-rata based on their holdings.",
        code: "distribute_yield(revenue)",
    },
    {
        step: "04",
        icon: Shield,
        title: "Audit Trail",
        description: "Every transaction is recorded on-chain with timestamps, amounts, and participant addresses.",
        code: "get_transaction_log()",
    },
];

const HowItWorks = () => {
    return (
        <section id="how-it-works" className="py-20 bg-secondary/30">
            <div className="container mx-auto px-4">
                <div className="max-w-2xl mb-12">
                    <h2 className="text-3xl font-bold text-foreground mb-4">
                        Protocol Architecture
                    </h2>
                    <p className="text-muted-foreground">
                        A composable framework for tokenized ownership and automated distributions.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {steps.map((step, index) => (
                        <Card 
                            key={index} 
                            className="p-5 bg-card border-border hover:border-primary/30 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                                    <step.icon className="w-5 h-5 text-primary" />
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">
                                    {step.step}
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                {step.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                {step.description}
                            </p>
                            <code className="text-xs font-mono text-primary/80 bg-primary/5 px-2 py-1 rounded">
                                {step.code}
                            </code>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;