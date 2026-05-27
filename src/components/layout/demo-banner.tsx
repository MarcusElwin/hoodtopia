import Link from "next/link";
import { Sparkles } from "lucide-react";

// Top-of-page banner so customers + reviewers can never miss that this is a
// demo — no real orders, no real payments, no real data retention. Required
// by the Kustom Playground TOS and useful so the meetup audience doesn't
// think they can shop here for real. Rendered in the layout above <Header>
// so it flows with the page (not sticky/fixed — scrolls away on long pages,
// which is fine since the URL and footer both reinforce the demo nature).
export function DemoBanner() {
  return (
    <div className="relative z-50 bg-gradient-to-r from-primary/90 via-fuchsia-500/90 to-amber-500/90 text-primary-foreground">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-center">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>Demo site</strong> built for agentic e-commerce — no real
          orders or payments are taken ·{" "}
          <Link href="/terms" className="underline hover:no-underline">
            See terms
          </Link>
        </span>
      </div>
    </div>
  );
}
