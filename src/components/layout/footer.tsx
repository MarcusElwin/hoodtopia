import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <span className="text-sm font-bold text-primary-foreground">H</span>
            </div>
            <span className="font-semibold">Hoodtopia</span>
            <span className="text-muted-foreground text-sm flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              AI-Powered Shopping
            </span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/products" className="hover:text-foreground transition-colors">
              Shop
            </Link>
            <Link href="/products?tab=ai" className="hover:text-foreground transition-colors">
              AI Recommendations
            </Link>
          </nav>

          {/* Demo Badge */}
          <div className="text-xs text-muted-foreground">
            Demo for LangChain Stockholm Meetup
          </div>
        </div>
      </div>
    </footer>
  );
}
