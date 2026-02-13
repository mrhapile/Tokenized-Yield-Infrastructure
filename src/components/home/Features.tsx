import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, BarChart3, Award, Leaf, Globe, Lock } from "lucide-react";

const features = [
    {
        icon: Shield,
        title: "Decentralized Ownership",
        description: "True ownership backed by smart contracts and immutable blockchain records.",
        badge: "Secure",
    },
    {
        icon: BarChart3,
        title: "Transparent Yield Tracking",
        description: "Real-time analytics and reporting on your agricultural investments.",
        badge: "Analytics",
    },
    {
        icon: Award,
        title: "Asset Share Certificates",
        description: "Unique digital certificates proving ownership of tokenized asset shares.",
    },
    {
        icon: Leaf,
        title: "Audit-Verified Yields",
        description: "Support eco-friendly agricultural practices with measurable impact.",
        badge: "Green",
    },
    {
        icon: Globe,
        title: "Global Marketplace",
        description: "Access worldwide agricultural opportunities from a single platform.",
        badge: "Worldwide",
    },
    {
        icon: Lock,
        title: "Smart Contract Security",
        description: "Audited contracts ensuring the safety of your investments.",
        badge: "Audited",
    },
];

const Features = () => {
    return (
        <section id="features" className="py-16 md:py-24">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12 md:mb-16">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">Platform Features</h2>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                        Everything you need to invest in the future of agriculture
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-7xl mx-auto">
                    {features.map((feature, index) => (
                        <Card
                            key={index}
                            className="p-6 bg-gradient-card border-border hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/30 transition-colors">
                                    <feature.icon className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xl font-bold text-foreground">{feature.title}</h3>
                                        <Badge variant="outline" className="border-primary/30 text-primary">
                                            {feature.badge}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-sm">{feature.description}</p>
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