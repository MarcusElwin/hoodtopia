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
      {/* Square crop with rounded-none — the card reads as a hang-tag,
          the product as the tag. Removes the universal Tailwind
          rounded-lg shortcut from every product on the site. */}
      <div className="relative aspect-square overflow-hidden bg-secondary/50">
        <Image
          src={displayImage}
          alt={`${product.name} - ${displayVariant?.color || ''}`}
          fill
          // No hover-scale on the image — the universal scale-105
          // pattern reads as Animation Done Once And Reused Everywhere.
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Editor's Choice — brass-bordered transparent hang-tag.
            Reads like a garment label, not a SaaS status chip. */}
        {product.featured && (
          <div className="absolute top-3 left-3">
            <span className="border border-primary text-primary bg-transparent px-2.5 py-1 text-[9px] uppercase tracking-[0.12em]">
              Editor&apos;s Choice
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          {/* Name picks up a thin brass underline on hover — more
              considered than swapping the whole text colour. */}
          <h3 className="font-medium text-sm leading-tight underline decoration-transparent decoration-1 underline-offset-4 group-hover:decoration-primary transition-colors">
            {product.name}
          </h3>
          {/* Price on the data register — Geist Mono with tabular-nums
              so numerals align vertically across a grid of cards. */}
          <span className="text-sm font-mono font-medium tracking-tight tabular-nums whitespace-nowrap">
            {formatPrice(product.basePrice)}
          </span>
        </div>

        {/* Category — small-caps, tracked. */}
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {product.category}
        </p>

        {/* Color Swatches — small squares (not circles) so the swatch
            shape matches the squared image + hang-tag register. Active
            swatch uses a single brass border, no ring halo. */}
        <div className="flex items-center gap-1.5 pt-1">
          {colorVariants.slice(0, 5).map((c) => (
            <div
              key={c.color}
              className={`h-3 w-3 border ${
                displayVariant?.color === c.color
                  ? "border-primary border-2"
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
