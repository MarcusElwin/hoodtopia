import Link from "next/link";
import { Button } from "@/components/ui/button";

// Savile Row hero: serif display headline ("Wear Something Considered"),
// quieter sub-copy in body sans, hairline-framed callouts instead of bold
// numbers, demoted secondary CTA to a text link. Background gradient
// loses the centred radial pull and uses a single edge wash so the page
// reads like an editorial spread.
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Warm-dark wash, top-down so the headline sits in the lighter band. */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />

      {/* Hairline grid kept but dimmed further to feel like watermark
          paper rather than a tech-startup pattern. */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative container mx-auto px-4 py-32 md:py-44 lg:py-56">
        <div className="max-w-3xl mx-auto text-center space-y-10">
          {/* Small caps eyebrow — replaces the Sparkles badge. Quieter,
              signals the AI angle without claiming it. */}
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
            Hoodtopia — Stockholm
          </p>

          {/* Headline. Italic second line in Playfair lifts the brand
              from "shop our hoodies" to "wear something considered". */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.05]">
            Wear Something
            <span className="block italic text-primary font-normal">
              Considered
            </span>
          </h1>

          {/* Sub-copy: shorter, less hype, more confident. */}
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            A small collection of hoodies, kept in considered colours.
            Quietly guided by an in-house stylist when you want a second
            opinion.
          </p>

          {/* CTAs: primary stays a real button; secondary demoted to a
              right-arrow text link so the eye lands on Shop. */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
            <Link href="/products">
              <Button size="lg" className="text-sm tracking-[0.08em] uppercase px-10 h-12 rounded-none">
                Shop the Collection
              </Button>
            </Link>
            <Link
              href="/products?tab=ai"
              className="text-sm tracking-[0.08em] uppercase text-muted-foreground hover:text-foreground transition-colors"
            >
              → Ask the Stylist
            </Link>
          </div>

          {/* Stats as hairline-framed callouts. The brass top rule used
              to be a sibling <div>, but HTML's description-list spec
              only allows <dt> and <dd> as children of <dl> (or a wrapper
              that itself contains only those). Moved the rule onto <dt>
              as a top border to keep semantics clean. */}
          <dl className="grid grid-cols-3 gap-8 max-w-md mx-auto pt-12 text-center">
            {[
              { figure: "6", label: "Styles" },
              { figure: "8", label: "Colours" },
              { figure: "288", label: "Variants" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-3 border-t border-primary/40 max-w-[2rem] mx-auto">
                  {stat.label}
                </dt>
                <dd className="text-2xl font-display font-normal mt-2">{stat.figure}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
