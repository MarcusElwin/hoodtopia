"use client";

import Link from "next/link";
import { ShoppingCart, Sparkles, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: cart } = trpc.cart.get.useQuery();

  const itemCount = cart?.itemCount || 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">H</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Hoodtopia</span>
          <Badge variant="secondary" className="hidden sm:flex gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            AI-Powered
          </Badge>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/products"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Shop
          </Link>
          <Link
            href="/products?tab=ai"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            AI Recommendations
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cart Button */}
          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs font-medium text-primary-foreground flex items-center justify-center">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
              <span className="sr-only">Cart</span>
            </Button>
          </Link>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link
                  href="/products"
                  className="text-lg font-medium hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Shop All
                </Link>
                <Link
                  href="/products?tab=ai"
                  className="text-lg font-medium hover:text-primary transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Recommendations
                </Link>
                <Link
                  href="/cart"
                  className="text-lg font-medium hover:text-primary transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Cart {itemCount > 0 && `(${itemCount})`}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
