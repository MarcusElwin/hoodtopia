"use client";

import { ProductCard } from "./product-card";
import { AdaptiveProductCard } from "./adaptive-product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/lib/shopper-profiles";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  category?: string;
}

export function ProductGrid({ category }: ProductGridProps) {
  const { data: products, isLoading } = trpc.products.list.useQuery({
    category,
  });
  const { config, isProfileActive } = useProfile();

  // Get adaptive grid layout based on profile
  const layoutClass = config?.theme.layout ? {
    single: "grid-cols-1 max-w-2xl mx-auto",
    grid: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    list: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    comparison: "grid-cols-1 md:grid-cols-2",
    feed: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  }[config.theme.layout] : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  // Get spacing based on profile
  const gapClass = config?.theme.spacing ? {
    tight: "gap-3",
    normal: "gap-4 md:gap-6",
    relaxed: "gap-6 md:gap-8",
  }[config.theme.spacing] : "gap-4 md:gap-6";

  if (isLoading) {
    return (
      <div className={cn("grid", layoutClass, gapClass)}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No products found</p>
      </div>
    );
  }

  return (
    <div className={cn("grid", layoutClass, gapClass)}>
      {products.map((product) => (
        isProfileActive ? (
          <AdaptiveProductCard key={product.id} product={product} />
        ) : (
          <ProductCard key={product.id} product={product} />
        )
      ))}
    </div>
  );
}
