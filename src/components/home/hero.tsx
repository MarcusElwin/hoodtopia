import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative container mx-auto px-4 py-24 md:py-32 lg:py-40">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI-Powered Shopping Experience</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            Find Your Perfect
            <span className="block text-primary">Hoodie</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Tell us what you&apos;re looking for and our AI will recommend the perfect hoodie for your style, activity, and climate.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/products">
              <Button size="lg" className="text-base px-8 h-12">
                Shop Collection
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/products?tab=ai">
              <Button size="lg" variant="outline" className="text-base px-8 h-12">
                <Sparkles className="mr-2 h-4 w-4" />
                Get AI Recommendations
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 md:gap-12 pt-8 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">6</div>
              <div className="text-muted-foreground">Styles</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold">8</div>
              <div className="text-muted-foreground">Colors</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold">288</div>
              <div className="text-muted-foreground">Variants</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
