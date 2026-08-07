"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Check, Minus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency";
import { type Product, type ProductVariant } from "@/db/schema";

interface ProductComparisonProps {
  products: (Product & { variants: ProductVariant[] })[];
  onClose: () => void;
  aiInsight?: string;
}

export function ProductComparison({ products, onClose, aiInsight }: ProductComparisonProps) {
  const { formatMoney } = useCurrency();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  if (products.length === 0) return null;

  // Product type with variants
  type ProductWithVariants = Product & { variants: ProductVariant[] };

  // Get comparison attributes
  const getFeatures = (product: ProductWithVariants) => {
    try {
      return product.features ? JSON.parse(product.features) : [];
    } catch {
      return [];
    }
  };

  // Get all unique features across products
  const allFeatures = Array.from(
    new Set(products.flatMap((p: ProductWithVariants) => getFeatures(p)))
  );

  // Get price range for a product
  const getPriceRange = (product: ProductWithVariants) => {
    const prices = product.variants.map(() => product.basePrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
  };

  // Get available colors for a product
  const getColors = (product: ProductWithVariants) => {
    return product.variants.reduce((acc: { color: string; colorHex: string }[], v: ProductVariant) => {
      if (!acc.find((c: { color: string; colorHex: string }) => c.color === v.color)) {
        acc.push({ color: v.color, colorHex: v.colorHex });
      }
      return acc;
    }, [] as { color: string; colorHex: string }[]);
  };

  // Get available sizes for a product
  const getSizes = (product: ProductWithVariants) => {
    return [...new Set(product.variants.map((v: ProductVariant) => v.size))];
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Compare Products</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Side-by-side comparison of {products.length} products
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* AI Insight Banner */}
        {aiInsight && (
          <div className="bg-primary/5 border-b border-primary/10 p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-primary text-sm">✨</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">AI Recommendation</p>
                <p className="text-sm text-muted-foreground">{aiInsight}</p>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-4 font-medium w-48">Attribute</th>
                {products.map((product) => (
                  <th key={product.id} className="p-4 font-medium text-center min-w-[250px]">
                    <div className="space-y-2">
                      {/* Product Image */}
                      <div className="relative aspect-square w-32 mx-auto rounded-lg overflow-hidden bg-secondary">
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="128px"
                        />
                      </div>
                      {/* Product Name */}
                      <div className="font-semibold text-sm">{product.name}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price Row */}
              <tr className="border-b">
                <td className="p-4 font-medium">Price</td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    <span className="text-lg font-semibold">{getPriceRange(product)}</span>
                  </td>
                ))}
              </tr>

              {/* Category Row */}
              <tr className="border-b bg-muted/20">
                <td className="p-4 font-medium">Category</td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    <Badge variant="secondary" className="capitalize">
                      {product.category}
                    </Badge>
                  </td>
                ))}
              </tr>

              {/* Material Row */}
              <tr className="border-b">
                <td className="p-4 font-medium">Material</td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    {product.material || <Minus className="h-4 w-4 mx-auto text-muted-foreground" />}
                  </td>
                ))}
              </tr>

              {/* Description Row */}
              <tr className="border-b bg-muted/20">
                <td className="p-4 font-medium">Description</td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center text-sm text-muted-foreground">
                    {product.description}
                  </td>
                ))}
              </tr>

              {/* Features Rows */}
              {allFeatures.map((feature, idx) => (
                <tr key={feature} className={`border-b ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <td className="p-4 font-medium text-sm">{feature}</td>
                  {products.map((product) => (
                    <td key={product.id} className="p-4 text-center">
                      {getFeatures(product).includes(feature) ? (
                        <Check className="h-5 w-5 mx-auto text-green-500" />
                      ) : (
                        <X className="h-5 w-5 mx-auto text-muted-foreground/30" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Colors Row */}
              <tr className="border-b">
                <td className="p-4 font-medium">Available Colors</td>
                {products.map((product) => (
                  <td key={product.id} className="p-4">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {getColors(product).slice(0, 8).map((c: { color: string; colorHex: string }) => (
                        <div
                          key={c.color}
                          className="h-6 w-6 rounded-full border border-border"
                          style={{ backgroundColor: c.colorHex }}
                          title={c.color}
                        />
                      ))}
                      {getColors(product).length > 8 && (
                        <span className="text-xs text-muted-foreground self-center">
                          +{getColors(product).length - 8}
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Sizes Row */}
              <tr className="border-b bg-muted/20">
                <td className="p-4 font-medium">Available Sizes</td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center text-sm">
                    {getSizes(product).join(", ")}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer with Actions */}
        <div className="border-t p-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onClose}>
              Close Comparison
            </Button>
            <div className="flex gap-2">
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.slug}`}>
                  <Button>
                    View {product.name.split(' ')[0]}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
