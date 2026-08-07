"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency";
import { trpc } from "@/lib/trpc";

interface ChatProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  imageUrl: string;
  category: string;
  variantId?: string;
  variantColor?: string;
  variantSize?: string;
}

interface ChatProductCardProps {
  product: ChatProduct;
}

export function ChatProductCard({ product }: ChatProductCardProps) {
  const { formatMoney, currency } = useCurrency();
  const [added, setAdded] = useState(false);
  const utils = trpc.useUtils();

  const addToCartMutation = trpc.cart.addItem.useMutation({
    onSuccess: () => {
      setAdded(true);
      utils.cart.get.invalidate();
      setTimeout(() => setAdded(false), 2000);
    },
  });

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!product.variantId) return;

    addToCartMutation.mutate({
      productId: product.id,
      variantId: product.variantId,
      quantity: 1,
      currency: currency.code,
    });
  };

  const isLoading = addToCartMutation.isPending;
  const canAddToCart = !!product.variantId;

  return (
    <div className="group flex gap-3 p-2 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 hover:bg-background/80 transition-all">
      {/* Product Image - Clickable */}
      <Link
        href={`/products/${product.slug}`}
        className="relative w-16 h-16 rounded-lg overflow-hidden bg-secondary/50 shrink-0"
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-110"
          sizes="64px"
        />
      </Link>

      {/* Product Info */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <Link href={`/products/${product.slug}`}>
          <h4 className="font-medium text-sm leading-tight truncate group-hover:text-primary transition-colors">
            {product.name}
          </h4>
        </Link>
        <p className="text-xs text-muted-foreground capitalize mt-0.5">
          {product.category}
          {product.variantColor && ` • ${product.variantColor}`}
        </p>
        <p className="text-sm font-semibold text-primary mt-1">
          {formatMoney(product.basePrice)}
        </p>
      </div>

      {/* Add to Cart Button */}
      {canAddToCart && (
        <div className="flex items-center shrink-0">
          <Button
            size="sm"
            variant={added ? "secondary" : "default"}
            className="h-8 w-8 p-0"
            onClick={handleAddToCart}
            disabled={isLoading || added}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : added ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

interface ChatProductGridProps {
  products: ChatProduct[];
}

export function ChatProductGrid({ products }: ChatProductGridProps) {
  if (products.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {products.map((product) => (
        <ChatProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
