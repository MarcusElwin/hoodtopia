import { Sparkles, Heart, Leaf, Users } from "lucide-react";
import { AIChatButton } from "@/components/ai/chat-button";

export default function OurStoryPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

        <div className="relative container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Our Story</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Comfort Meets
              <span className="block text-primary">Intelligence</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Hoodtopia was born from a simple idea: what if finding the perfect
              hoodie was as easy as having a conversation?
            </p>
          </div>
        </div>
      </section>

      {/* Story Content */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {/* Origin */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">The Beginning</h2>
              <p className="text-muted-foreground leading-relaxed">
                We started Hoodtopia because we were tired of endless scrolling,
                confusing size charts, and product descriptions that never
                matched reality. As hoodie enthusiasts ourselves, we knew there
                had to be a better way.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                In 2024, we combined our love for premium comfort wear with
                cutting-edge AI technology. The result? A shopping experience
                that actually understands what you&apos;re looking for.
              </p>
            </div>

            {/* AI Section */}
            <div className="space-y-4 p-6 rounded-2xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">AI-Powered Shopping</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Our AI shopping assistant doesn&apos;t just search keywords—it
                understands context. Tell it you need something warm for hiking
                in cold weather, and it knows to recommend our heavyweight
                options with moisture-wicking properties. Looking for something
                stylish for a casual office? It&apos;ll suggest our sleeker,
                more refined styles.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Powered by GPT-5.1 with structured outputs, our AI delivers
                personalized recommendations that actually make sense.
              </p>
            </div>

            {/* Values */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">What We Believe</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Leaf className="h-5 w-5 text-green-500" />
                    </div>
                    <h3 className="font-semibold">Quality Over Quantity</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We offer 6 carefully curated styles instead of hundreds.
                    Each one is perfected, not just produced.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <h3 className="font-semibold">Customer-First</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Our AI learns from every interaction to give you better
                    recommendations, not more ads.
                  </p>
                </div>
              </div>
            </div>

            {/* Demo Note */}
            <div className="p-6 rounded-2xl bg-secondary/50 border">
              <h3 className="font-semibold mb-2">About This Demo</h3>
              <p className="text-sm text-muted-foreground">
                Hoodtopia is a demonstration of Agentic Commerce—built for the
                LangChain Stockholm Meetup. It showcases how AI can transform
                e-commerce from passive browsing to active, conversational
                shopping experiences. The products are fictional, but the
                technology is very real.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Built with Next.js, tRPC, GPT-5.1, and Gemini-generated product
                images.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AIChatButton />
    </div>
  );
}
