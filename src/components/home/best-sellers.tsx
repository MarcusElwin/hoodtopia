"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

export function BestSellers() {
  const { data: products, isLoading } = trpc.products.list.useQuery();

  // Simulate best sellers by taking products sorted by category variety
  const bestSellers = products
    ?.sort((a, b) => b.basePrice - a.basePrice)
    .slice(0, 3);

  return (
    <section id="best-sellers" className="py-16 md:py-24 bg-secondary/30 scroll-mt-20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-sm font-medium mb-4">
              <TrendingUp className="h-4 w-4" />
              Trending Now
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Best Sellers
            </h2>
            <p className="text-muted-foreground mt-2">
              Our most loved hoodies, chosen by customers like you
            </p>
          </div>
          <Link href="/products" className="hidden sm:block">
            <Button variant="ghost" className="gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bestSellers?.map((product, index) => (
              <div key={product.id} className="relative">
                {/* Rank Badge */}
                <div className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                  #{index + 1}
                </div>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}

        {/* Mobile View All Button */}
        <div className="mt-8 text-center sm:hidden">
          <Link href="/products">
            <Button variant="outline" className="gap-2">
              View All Products
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
