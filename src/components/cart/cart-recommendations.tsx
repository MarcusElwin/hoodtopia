"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/lib/currency";
import type { CartRecommendationWithProduct } from "@/services/schemas";

export function CartRecommendations() {
  const { formatPrice, currency } = useCurrency();
  const { data, isLoading } = trpc.cart.getRecommendations.useQuery({
    symbol: currency.symbol,
  });
  const cartQuery = trpc.cart.get.useQuery();
  const addToCartMutation = trpc.cart.addItem.useMutation({
    onSuccess: () => {
      cartQuery.refetch();
    },
  });

  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  // Don't show if cart is empty and not loading
  if (!isLoading && (!data || data.recommendations.length === 0)) {
    return null;
  }

  const handleAddToCart = async (
    recommendation: CartRecommendationWithProduct
  ) => {
    if (!recommendation.product) return;

    setAddingProductId(recommendation.product.id);

    // Get first available variant
    const firstVariant = recommendation.product.variants?.[0];
    if (!firstVariant) {
      console.error("No variants available");
      setAddingProductId(null);
      return;
    }

    try {
      await addToCartMutation.mutateAsync({
        productId: recommendation.product.id,
        variantId: firstVariant.id,
        quantity: 1,
      });
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setAddingProductId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">
          Complete Your Look
        </h2>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      {/* AI Analysis */}
      {!isLoading && data?.cartAnalysis && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {data.cartAnalysis}
        </p>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border bg-card overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations Grid */}
      {!isLoading && data && data.recommendations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.recommendations.map((rec) => {
            if (!rec.product) return null;

            return (
              <div
                key={rec.product.id}
                className="rounded-lg border bg-card overflow-hidden hover:shadow-sm transition-shadow"
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-secondary">
                  <Image
                    src={rec.product.imageUrl}
                    alt={rec.product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>

                {/* Product Info */}
                <div className="p-3 space-y-2">
                  <div>
                    <h3 className="font-medium text-sm line-clamp-1">
                      {rec.product.name}
                    </h3>
                    <p className="text-sm font-semibold mt-1">
                      {formatPrice(rec.product.basePrice)}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {rec.reason}
                  </p>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => handleAddToCart(rec)}
                    disabled={addingProductId === rec.product.id}
                    className="w-full bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {addingProductId === rec.product.id ? (
                      <>
                        <Plus className="h-3 w-3 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" />
                        Add
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
