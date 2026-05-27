"use client";

import { useState, useMemo } from "react";
import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Minus, Plus, ShoppingBag, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AIChatButton } from "@/components/ai/chat-button";
import { PaymentMethodDisplay } from "@/components/kustom/payment-method-display";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/lib/currency";
import { track } from "@/lib/analytics";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = use(params);
  const { data: product, isLoading, error } = trpc.products.bySlug.useQuery(slug);
  const { formatPrice, currency, country } = useCurrency();

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const utils = trpc.useUtils();
  const addToCartMutation = trpc.cart.addItem.useMutation({
    onSuccess: () => {
      // Refetch cart and product so the new stock count shows immediately.
      utils.cart.get.invalidate();
      utils.products.bySlug.invalidate();
    },
  });

  // Get unique colors
  const colors = useMemo(() => {
    if (!product) return [];
    return product.variants.reduce(
      (acc, v) => {
        if (!acc.find((c) => c.color === v.color)) {
          acc.push({ color: v.color, colorHex: v.colorHex });
        }
        return acc;
      },
      [] as { color: string; colorHex: string }[]
    );
  }, [product]);

  // Get unique sizes
  const sizes = useMemo(() => {
    if (!product) return [];
    const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
    const uniqueSizes = [...new Set(product.variants.map((v) => v.size))];
    return uniqueSizes.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
  }, [product]);

  // Initialize defaults when product changes (derived state pattern)
  const defaultColor = colors.length > 0 ? colors[0].color : null;
  const defaultSize = sizes.length > 0 ? sizes[0] : null;

  // Only use state if user hasn't made a selection, otherwise use defaults
  const actualSelectedColor = selectedColor ?? defaultColor;
  const actualSelectedSize = selectedSize ?? defaultSize;

  // Get current image based on selected color
  const currentImage = useMemo(() => {
    if (!product || !actualSelectedColor) return product?.imageUrl || "";
    // Find a variant with the selected color to get its image
    const colorVariant = product.variants.find((v) => v.color === actualSelectedColor);
    return colorVariant?.imageUrl || product.imageUrl;
  }, [product, actualSelectedColor]);

  // Get selected variant
  const selectedVariant = useMemo(() => {
    if (!product || !actualSelectedColor || !actualSelectedSize) return null;
    return product.variants.find(
      (v) => v.color === actualSelectedColor && v.size === actualSelectedSize
    );
  }, [product, actualSelectedColor, actualSelectedSize]);

  // Parse features
  const features = useMemo(() => {
    if (!product?.features) return [];
    try {
      return JSON.parse(product.features) as string[];
    } catch {
      return [];
    }
  }, [product]);

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    addToCartMutation.mutate(
      {
        productId: product.id,
        variantId: selectedVariant.id,
        quantity,
      },
      {
        onSuccess: () => {
          track("add_to_cart", {
            productId: product.id,
            productSlug: product.slug,
            variantSku: selectedVariant.sku,
            quantity,
            price: product.basePrice,
            currency: currency.code,
            country: country.code,
            scarce: selectedVariant.stock - quantity <= 5,
          });
        },
        onError: (err) => {
          if (err.data?.code === "CONFLICT") {
            track("out_of_stock_blocked", {
              variantSku: selectedVariant.sku,
              attempted_qty: quantity,
              stock_at_block: selectedVariant.stock,
            });
          }
        },
      }
    );
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Product not found</p>
        <Link href="/products">
          <Button variant="ghost" className="mt-4">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/products"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Products
          </Link>
        </div>
      </div>

      {/* Product Content */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary/50">
            <Image
              src={currentImage}
              alt={`${product.name} - ${actualSelectedColor || ""}`}
              fill
              className="object-cover transition-opacity duration-300"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              key={currentImage}
            />
            {product.featured && (
              <Badge className="absolute top-4 left-4">Featured</Badge>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground capitalize mb-2">
                {product.category}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {product.name}
              </h1>
              <p className="text-2xl font-semibold mt-4">
                {formatPrice(product.basePrice)}
              </p>
              <div className="mt-2">
                <PaymentMethodDisplay />
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            <Separator />

            {/* Color Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Color</span>
                <span className="text-sm text-muted-foreground capitalize">
                  {actualSelectedColor}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.color}
                    onClick={() => setSelectedColor(c.color)}
                    className={`relative h-10 w-10 rounded-full border-2 transition-all ${
                      actualSelectedColor === c.color
                        ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "border-border hover:border-foreground/50"
                    }`}
                    style={{ backgroundColor: c.colorHex }}
                    title={c.color}
                  >
                    {actualSelectedColor === c.color && (
                      <Check
                        className={`absolute inset-0 m-auto h-5 w-5 ${
                          ["White", "Cream", "Beige"].includes(c.color)
                            ? "text-black"
                            : "text-white"
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div className="space-y-3">
              <span className="text-sm font-medium">Size</span>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`h-10 min-w-[44px] px-4 rounded-md border text-sm font-medium transition-all ${
                      actualSelectedSize === size
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-foreground/50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-3">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={
                    quantity >= 10 ||
                    (selectedVariant ? quantity >= selectedVariant.stock : false)
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Stock Status */}
            {selectedVariant && (
              <p
                className={`text-sm ${
                  selectedVariant.stock === 0
                    ? "text-destructive font-medium"
                    : selectedVariant.stock <= 5
                      ? "text-amber-500 font-medium"
                      : "text-muted-foreground"
                }`}
              >
                {selectedVariant.stock > 10
                  ? "In Stock"
                  : selectedVariant.stock > 0
                    ? `Only ${selectedVariant.stock} left`
                    : "Out of Stock"}
              </p>
            )}

            {/* Add to Cart */}
            <Button
              size="lg"
              className="w-full h-12 text-base"
              onClick={handleAddToCart}
              disabled={
                !selectedVariant ||
                selectedVariant.stock === 0 ||
                addToCartMutation.isPending
              }
            >
              {addToCartMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <ShoppingBag className="h-5 w-5 mr-2" />
              )}
              {addToCartMutation.isSuccess ? "Added to Cart!" : "Add to Cart"}
            </Button>

            {addToCartMutation.error ? (
              <p className="text-sm text-destructive">
                {addToCartMutation.error.message}
              </p>
            ) : null}

            <Separator />

            {/* Product Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Product Details</h3>
              {product.material && (
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground">Material:</span>{" "}
                  {product.material}
                </p>
              )}
              {features.length > 0 && (
                <ul className="space-y-2">
                  {features.map((feature, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <AIChatButton />
    </div>
  );
}
