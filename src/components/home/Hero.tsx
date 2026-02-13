import { Button } from "@/components/ui/button";
import { ArrowRight, Sprout } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import heroBg from "public/assets/hero-bg.jpg";

const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${heroBg})` }}
            >
                <Image src={heroBg} alt='hero image' fill style={{ objectFit: "cover" }}></Image>
                <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/80 to-background"></div>
            </div>

            <div className="relative z-10 container mx-auto px-4 py-20 text-center">
                <div className="flex justify-center mb-6 animate-fade-in-up">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
                        <Sprout className="w-4 h-4 text-primary" />
                        <span className="text-sm text-primary font-medium">Powered by Blockchain Technology</span>
                    </div>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in-up [animation-delay:0.1s] bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
                    Tokenized Yield Infrastructure
                </h1>

                <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 animate-fade-in-up [animation-delay:0.2s]">
                    On-Chain Share Issuance & Revenue Distribution Engine.
                    Institutional grade asset tokenization.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up [animation-delay:0.3s]">
                    <Link href='/create-vault'>
                        <Button
                            size="lg"
                            className="bg-gradient-hero text-primary-foreground hover:opacity-90 transition-all duration-300 glow-primary group"
                        >
                            Initialize Vault
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                    <Button
                        size="lg"
                        variant="outline"
                        className="border-primary/50 text-primary hover:bg-primary/10"
                    >
                        Explore Yield Vaults
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-4xl mx-auto animate-fade-in-up [animation-delay:0.4s]">
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-primary mb-2">$2.3M</div>
                        <div className="text-muted-foreground">Total Value Locked</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-accent mb-2">340</div>
                        <div className="text-muted-foreground">Active Share Classes</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-primary mb-2">1.2K</div>
                        <div className="text-muted-foreground">Active Investors</div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
        </section>
    );
};

export default Hero;