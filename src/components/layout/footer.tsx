"use client";

import Link from "next/link";
import { Sparkles, Mail, Instagram, Twitter, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoodtopiaLogo } from "@/components/ui/logo";
import { PaymentMethodDisplay } from "@/components/kustom/payment-method-display";
import { DeliveryMethodDisplay } from "@/components/kustom/delivery-method-display";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-secondary/20">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <HoodtopiaLogo className="h-8 w-8" />
              <span className="text-lg font-bold">Hoodtopia</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Informed by preference. Guided by restraint.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <Instagram className="h-4 w-4" />
                <span className="sr-only">Instagram</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <Twitter className="h-4 w-4" />
                <span className="sr-only">Twitter</span>
              </Button>
              <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <a
                  href="https://github.com/MarcusElwin/hoodtopia"
                  target="_blank"
                  rel="noopener"
                  title="View source on GitHub"
                >
                  <Github className="h-4 w-4" />
                  <span className="sr-only">GitHub</span>
                </a>
              </Button>
            </div>
          </div>

          {/* Shop Column */}
          <div className="space-y-4">
            <h3 className="font-semibold">Shop</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/products" className="text-muted-foreground hover:text-foreground transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/#best-sellers" className="text-muted-foreground hover:text-foreground transition-colors">
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link href="/products?tab=ai" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Ask the Stylist
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-muted-foreground hover:text-foreground transition-colors">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link href="/checkout" className="text-muted-foreground hover:text-foreground transition-colors">
                  Checkout
                </Link>
              </li>
              <li>
                <Link href="/custom-designer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Custom Designer
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-4">
            <h3 className="font-semibold">Company</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/our-story" className="text-muted-foreground hover:text-foreground transition-colors">
                  Our Story
                </Link>
              </li>
              <li>
                <Link href="/sustainability" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sustainability
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-muted-foreground hover:text-foreground transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-muted-foreground hover:text-foreground transition-colors">
                  Shipping & Returns
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="space-y-4">
            <h3 className="font-semibold">Correspondence</h3>
            <p className="text-sm text-muted-foreground">
              Occasional updates. No noise.
            </p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <Input
                type="email"
                placeholder="your@email.com"
                className="h-10 bg-background"
              />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
                <Mail className="h-4 w-4" />
                <span className="sr-only">Subscribe</span>
              </Button>
            </form>
            <p className="text-xs text-muted-foreground/60">
              This is a demo. No emails will be sent.
            </p>
          </div>
        </div>
      </div>

      {/* Payment + Delivery method logo strips — pulled from Kustom Elements
          so they auto-update if we enable more methods/carriers in the Portal. */}
      <div className="border-t border-border/40">
        <div className="container mx-auto px-4 py-6 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Payment methods
            </p>
            <PaymentMethodDisplay />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Delivery partners
            </p>
            <DeliveryMethodDisplay />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <span>&copy; {new Date().getFullYear()} Hoodtopia</span>
              <span className="hidden md:inline">·</span>
              <span className="text-xs">
                Demo built for agentic e-commerce ·{" "}
                <a
                  href="https://github.com/MarcusElwin/hoodtopia"
                  target="_blank"
                  rel="noopener"
                  className="underline hover:no-underline"
                >
                  open source
                </a>
              </span>
              <span className="hidden md:inline">·</span>
              <span className="text-xs">
                Powered by{" "}
                <a
                  href="https://www.kustom.co"
                  target="_blank"
                  rel="noopener"
                  className="underline hover:no-underline"
                >
                  Kustom
                </a>
                {" + "}
                <a
                  href="https://vercel.com"
                  target="_blank"
                  rel="noopener"
                  className="underline hover:no-underline"
                >
                  Vercel
                </a>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/shipping" className="hover:text-foreground transition-colors">Shipping</Link>
              <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
