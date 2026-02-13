import { Card } from "@/components/ui/card";
import { 
    Shield, 
    GitBranch, 
    Lock, 
    FileCheck, 
    Zap,
    Database
} from "lucide-react";

const features = [
    {
        icon: Shield,
        title: "Program-Level Security",
        description: "Ownership checks, PDA validation, and arithmetic overflow protection at every instruction boundary.",
        status: "Active",
    },
    {
        icon: GitBranch,
        title: "State Machine Invariants",
        description: "Vaults progress through defined states with enforced transitions. No invalid state combinations possible.",
        status: "Active",
    },
    {
        icon: Lock,
        title: "Authority Controls",
        description: "Multi-signature governance with timelocked upgrades. Admin actions require explicit authorization.",
        status: "Active",
    },
    {
        icon: FileCheck,
        title: "Audit-Ready Logs",
        description: "Every deposit, withdrawal, and distribution emits structured events for off-chain indexing.",
        status: "Active",
    },
    {
        icon: Zap,
        title: "High-Precision Math",
        description: "BPS-based calculations with documented rounding behavior. No hidden fee extraction or precision loss.",
        status: "Active",
    },
    {
        icon: Database,
        title: "Composable Accounts",
        description: "PDAs and token accounts follow predictable derivation paths. Easy integration with other protocols.",
        status: "Active",
    },
];

const Features = () => {
    return (
        <section id="features" className="py-20">
            <div className="container mx-auto px-4">
                <div className="max-w-2xl mb-12">
                    <h2 className="text-3xl font-bold text-foreground mb-4">
                        Technical Specifications
                    </h2>
                    <p className="text-muted-foreground">
                        Enterprise-grade security patterns and institutional compliance requirements.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map((feature, index) => (
                        <Card
                            key={index}
                            className="p-5 bg-card border-border hover:border-primary/30 transition-colors"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <feature.icon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h3 className="text-base font-semibold text-foreground truncate">
                                            {feature.title}
                                        </h3>
                                        <span className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            <span className="text-xs text-muted-foreground">
                                                {feature.status}
                                            </span>
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;