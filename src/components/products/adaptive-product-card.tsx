"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrency } from "@/lib/currency";
import { useProfile } from "@/lib/shopper-profiles";
import { type Product, type ProductVariant } from "@/db/schema";
import { cn } from "@/lib/utils";

interface AdaptiveProductCardProps {
  product: Product & { variants: ProductVariant[] };
}

export function AdaptiveProductCard({ product }: AdaptiveProductCardProps) {
  const { formatPrice } = useCurrency();
  const { config } = useProfile();
  const [isHovered, setIsHovered] = useState(false);

  // Get profile-specific styling
  const showQuickBuy = config?.uiPreferences.quickBuy ?? false;
  const showSpecs = config?.uiPreferences.showSpecs ?? "summary";
  const showReviews = config?.uiPreferences.showReviews ?? false;
  const priceEmphasis = config?.uiPreferences.showPrices ?? "normal";
  const imageSize = config?.uiPreferences.imageSize ?? "medium";
  const enableAnimations = config?.theme.animations ?? true;
  const spacing = config?.theme.spacing ?? "normal";

  // Profile colors
  const primaryColor = config?.theme.colors.primary;
  const accentColor = config?.theme.colors.accent;

  // Get available colors for this product
  const colors = product.variants.reduce((acc, v) => {
    if (!acc.find((c) => c.color === v.color)) {
      acc.push({ color: v.color, colorHex: v.colorHex });
    }
    return acc;
  }, [] as Array<{ color: string; colorHex: string }>);

  // Parse features
  const features = product.features ? JSON.parse(product.features) : [];

  // Image size classes
  const imageSizeClass = {
    small: "aspect-[4/3]",
    medium: "aspect-square",
    large: "aspect-[3/4]",
  }[imageSize];

  // Spacing classes
  const spacingClass = {
    tight: "gap-2 p-3",
    normal: "gap-3 p-4",
    relaxed: "gap-4 p-6",
  }[spacing];

  // Price size based on emphasis
  const priceClass = {
    prominent: "text-3xl font-bold",
    normal: "text-xl font-semibold",
    subtle: "text-base font-medium",
  }[priceEmphasis];

  return (
    <Card
      className={cn(
        "group overflow-hidden",
        enableAnimations && "transition-all duration-300",
        enableAnimations && isHovered && "scale-105 shadow-lg"
      )}
      onMouseEnter={() => enableAnimations && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderColor: isHovered && primaryColor ? `${primaryColor}40` : undefined,
      }}
    >
      <CardContent className={cn("flex flex-col", spacingClass)}>
        {/* Image */}
        <Link href={`/products/${product.slug}`} className="relative overflow-hidden rounded-lg">
          <div className={cn("relative w-full", imageSizeClass)}>
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-110"
            />
            {product.featured && (
              <Badge
                className="absolute top-2 right-2"
                style={{ backgroundColor: accentColor }}
              >
                Featured
              </Badge>
            )}
          </div>
        </Link>

        {/* Product Info */}
        <div className="flex flex-col gap-2 flex-1">
          {/* Title */}
          <Link href={`/products/${product.slug}`}>
            <h3 className="font-semibold hover:underline line-clamp-2">
              {product.name}
            </h3>
          </Link>

          {/* Price - Position based on emphasis */}
          <div className={cn("flex items-baseline gap-2", priceEmphasis === "prominent" && "order-first")}>
            <span className={priceClass} style={{ color: primaryColor }}>
              {formatPrice(product.basePrice)}
            </span>
            {priceEmphasis === "prominent" && (
              <span className="text-sm text-muted-foreground">
                Best value!
              </span>
            )}
          </div>

          {/* Description - Conditional based on specs setting */}
          {showSpecs !== "hidden" && (
            <p
              className={cn(
                "text-sm text-muted-foreground",
                showSpecs === "summary" && "line-clamp-2",
                showSpecs === "full" && "line-clamp-3"
              )}
            >
              {product.description}
            </p>
          )}

          {/* Material - Show for researcher profile */}
          {showSpecs === "full" && product.material && (
            <div className="text-xs">
              <span className="font-medium">Material:</span> {product.material}
            </div>
          )}

          {/* Features - Show for researcher */}
          {showSpecs === "full" && features.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {features.slice(0, 3).map((feature: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          )}

          {/* Colors */}
          {colors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {colors.length} {colors.length === 1 ? "color" : "colors"}
              </span>
              <div className="flex gap-1">
                {colors.slice(0, 4).map((c, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: c.colorHex }}
                    title={c.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reviews - Show for researcher and trendsetter */}
          {showReviews && (
            <div className="flex items-center gap-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className="h-3 w-3 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">(127)</span>
            </div>
          )}
        </div>

        {/* Quick Buy - Show for minimalist and budget hunter */}
        {showQuickBuy && (
          <Button
            className="w-full"
            size="sm"
            style={{
              backgroundColor: primaryColor,
              color: "white",
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Quick Buy
          </Button>
        )}

        {/* Regular CTA - Show for others */}
        {!showQuickBuy && (
          <Link href={`/products/${product.slug}`}>
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              style={{
                borderColor: primaryColor,
                color: primaryColor,
              }}
            >
              View Details
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
