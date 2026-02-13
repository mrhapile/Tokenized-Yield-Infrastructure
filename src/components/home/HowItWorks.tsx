import { Card } from "@/components/ui/card";
import { Coins, Repeat } from "lucide-react";

const steps = [
    {
        icon: Coins,
        title: "Tokenize Real-World Assets",
        description: "Convert physical assets into liquid on-chain shares using our vault standard.",
    },
    {
        icon: Coins,
        title: "Earn Yield Distributions",
        description: "Hold yield shares to earn revenue from infrastructure operations and verified cash flows.",
    },
    {
        icon: Repeat,
        title: "Trade & Grow",
        description: "Trade tokens on our marketplace and grow your agricultural investment portfolio with ease.",
    },
];

const HowItWorks = () => {
    return (
        <section id="how-it-works" className="py-16 md:py-24 bg-secondary/30 bg-gradient-to-b from-background/90 via-background/80 to-background">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12 md:mb-16">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">How It Works</h2>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                        Three simple steps to start your agricultural investment journey
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
                    {steps.map((step, index) => (
                        <div key={index} className="relative">
                            <Card className="p-6 md:p-8 bg-gradient-card border-primary/20 hover:border-primary/40 transition-all duration-300 glow-primary group h-full">
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-4 md:mb-6 relative">
                                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                                            <step.icon className="w-8 h-8 text-primary" />
                                        </div>
                                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-accent-foreground">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold mb-4 text-foreground">{step.title}</h3>
                                    <p className="text-muted-foreground">{step.description}</p>
                                </div>
                            </Card>

                            {index < steps.length - 1 && (
                                <div className="hidden md:block absolute top-1/2 -right-7 transform -translate-y-1/2 z-10">
                                    <div className="text-primary/30 text-3xl">→</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;