import { Leaf, Recycle, Droplets, Factory, Heart, Globe } from "lucide-react";
import { AIChatButton } from "@/components/ai/chat-button";

export default function SustainabilityPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-background to-background" />

        <div className="relative container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10">
              <Leaf className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Sustainability</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Fashion That
              <span className="block text-green-500">Cares</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              We believe great hoodies shouldn&apos;t cost the earth. Here&apos;s how we&apos;re
              working towards a more sustainable future.
            </p>
          </div>
        </div>
      </section>

      {/* Initiatives */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Materials */}
              <div className="p-6 rounded-2xl bg-secondary/30 border space-y-4">
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Recycle className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold">Recycled Materials</h3>
                <p className="text-muted-foreground">
                  30% of our cotton comes from recycled sources. By 2026, we aim to
                  use 100% sustainable materials across all products.
                </p>
              </div>

              {/* Water */}
              <div className="p-6 rounded-2xl bg-secondary/30 border space-y-4">
                <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Droplets className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold">Water Conservation</h3>
                <p className="text-muted-foreground">
                  Our dyeing process uses 50% less water than traditional methods.
                  Every hoodie saves approximately 20 liters of water.
                </p>
              </div>

              {/* Manufacturing */}
              <div className="p-6 rounded-2xl bg-secondary/30 border space-y-4">
                <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Factory className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold">Ethical Manufacturing</h3>
                <p className="text-muted-foreground">
                  All our manufacturing partners are certified for fair labor practices.
                  We visit factories annually to ensure standards are met.
                </p>
              </div>

              {/* Carbon */}
              <div className="p-6 rounded-2xl bg-secondary/30 border space-y-4">
                <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Globe className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold">Carbon Neutral Shipping</h3>
                <p className="text-muted-foreground">
                  We offset 100% of our shipping emissions through verified carbon
                  credit programs and reforestation initiatives.
                </p>
              </div>
            </div>

            {/* Goals */}
            <div className="mt-16 p-8 rounded-2xl bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-3 mb-6">
                <Heart className="h-6 w-6 text-green-500" />
                <h2 className="text-2xl font-bold">Our 2030 Goals</h2>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-green-500">1</span>
                  </div>
                  <p className="text-muted-foreground">100% sustainable and recycled materials in all products</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-green-500">2</span>
                  </div>
                  <p className="text-muted-foreground">Net-zero carbon emissions across our entire supply chain</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-green-500">3</span>
                  </div>
                  <p className="text-muted-foreground">Zero-waste packaging using only compostable materials</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-green-500">4</span>
                  </div>
                  <p className="text-muted-foreground">Hoodie take-back program for recycling and upcycling</p>
                </li>
              </ul>
            </div>

            {/* Demo Note */}
            <div className="mt-12 p-6 rounded-2xl bg-secondary/50 border text-center">
              <p className="text-sm text-muted-foreground">
                This is a demo page. Hoodtopia is a fictional brand created for the LangChain Stockholm Meetup
                to demonstrate AI-powered e-commerce experiences.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AIChatButton />
    </div>
  );
}
