"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { type Product, type ProductVariant } from "@/db/schema";
import { useCurrency } from "@/lib/currency";

interface ProductCardProps {
  product: Product & { variants: ProductVariant[] };
}

// Simple hash function to get consistent "random" index based on product id
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function ProductCard({ product }: ProductCardProps) {
  const { formatPrice } = useCurrency();

  // Get unique colors with their variant images
  const colorVariants = useMemo(() => {
    return product.variants.reduce(
      (acc, v) => {
        if (!acc.find((c) => c.color === v.color)) {
          acc.push({
            color: v.color,
            colorHex: v.colorHex,
            imageUrl: v.imageUrl
          });
        }
        return acc;
      },
      [] as { color: string; colorHex: string; imageUrl: string | null }[]
    );
  }, [product.variants]);

  // Pick a consistent "random" color based on product ID
  const displayVariant = useMemo(() => {
    if (colorVariants.length === 0) return null;
    const index = hashCode(product.id) % colorVariants.length;
    return colorVariants[index];
  }, [colorVariants, product.id]);

  const displayImage = displayVariant?.imageUrl || product.imageUrl;

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary/50">
        {/* Product Image */}
        <Image
          src={displayImage}
          alt={`${product.name} - ${displayVariant?.color || ''}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />

        {/* Featured Badge */}
        {product.featured && (
          <div className="absolute top-3 left-3">
            <span className="bg-primary px-2 py-1 text-xs font-medium text-primary-foreground rounded">
              Featured
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-tight group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <span className="text-sm font-semibold whitespace-nowrap">
            {formatPrice(product.basePrice)}
          </span>
        </div>

        {/* Category */}
        <p className="text-xs text-muted-foreground capitalize">
          {product.category}
        </p>

        {/* Color Swatches */}
        <div className="flex items-center gap-1.5 pt-1">
          {colorVariants.slice(0, 5).map((c) => (
            <div
              key={c.color}
              className={`h-3 w-3 rounded-full border ${
                displayVariant?.color === c.color
                  ? "border-primary ring-1 ring-primary"
                  : "border-border/50"
              }`}
              style={{ backgroundColor: c.colorHex }}
              title={c.color}
            />
          ))}
          {colorVariants.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{colorVariants.length - 5}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
