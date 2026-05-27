"use client";

import { useState, useMemo } from "react";
import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Minus, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AIChatButton } from "@/components/ai/chat-button";
import { PaymentMethodDisplay } from "@/components/kustom/payment-method-display";
import { DeliveryMethodDisplay } from "@/components/kustom/delivery-method-display";
import { ExpressButtons } from "@/components/kustom/express-buttons";
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
  // null = follow the color-driven variant image. A number means the user
  // tapped a thumbnail in the carousel and we should stop tracking colour.
  const [activeThumbIdx, setActiveThumbIdx] = useState<number | null>(null);

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

  // Variant matching the selected colour (any size; image is colour-driven).
  const colorVariant = useMemo(() => {
    if (!product || !actualSelectedColor) return null;
    return product.variants.find((v) => v.color === actualSelectedColor) ?? null;
  }, [product, actualSelectedColor]);

  // Hero image for the selected colour, falling back to product.imageUrl.
  const colorHero = colorVariant?.imageUrl || product?.imageUrl || "";

  // Carousel for the currently selected colour:
  //   1. colour-specific hero
  //   2. colour-specific extras (lifestyle, fabric close-up) from product_images
  // We intentionally do NOT include other-colour heroes here — the colour
  // swatches above already let the customer switch colours; duplicating
  // them in the thumb strip dilutes focus on the selected variant.
  const carouselImages = useMemo(() => {
    if (!product) return [] as { url: string; alt: string }[];

    const heroSet: { url: string; alt: string }[] = colorHero
      ? [{ url: colorHero, alt: `${product.name} — ${actualSelectedColor ?? ""}` }]
      : [];

    const extras = (product.images ?? [])
      .filter((img) => colorVariant && img.variantId === colorVariant.id)
      .map((img) => ({ url: img.url, alt: img.alt ?? product.name }));

    return [...heroSet, ...extras];
  }, [product, colorHero, actualSelectedColor, colorVariant]);

  // What we actually show in the big frame.
  const currentImage = activeThumbIdx !== null && carouselImages[activeThumbIdx]
    ? carouselImages[activeThumbIdx].url
    : colorHero;

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
      {/* Breadcrumb — "Collection / {product name}" in small caps, no
          icon. Editorial, not chevron-back-to-list. */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/products"
              className="hover:text-foreground transition-colors"
            >
              Collection
            </Link>
            <span className="mx-2 text-muted-foreground/60">/</span>
            <span className="text-foreground">{product.name}</span>
          </p>
        </div>
      </div>

      {/* Product Content */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image + carousel thumbnails */}
          <div className="space-y-3">
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
                // Same brass hang-tag treatment as the product card so
                // the PDP doesn't break the visual language we just
                // established. Plain <span> + Tailwind, no shadcn Badge
                // wrapper — Badge's defaults reintroduce the filled pill.
                <span className="absolute top-4 left-4 border border-primary text-primary bg-transparent px-2.5 py-1 text-[9px] uppercase tracking-[0.12em]">
                  Editor&apos;s Choice
                </span>
              )}
            </div>
            {carouselImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {carouselImages.map((img, i) => {
                  const isActive =
                    (activeThumbIdx === null && i === 0) || activeThumbIdx === i;
                  return (
                    // Wrapper holds the image AND the active underline
                    // as siblings. The previous :after-on-the-button
                    // approach had two bugs: Tailwind's `after:` utilities
                    // do nothing without `after:content-['']`, and even
                    // with it the underline was clipped by the button's
                    // `overflow-hidden` + negative `-bottom-1`. Real
                    // siblings render reliably.
                    <div key={`${img.url}-${i}`} className="shrink-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => setActiveThumbIdx(i)}
                        className={`relative block h-20 w-20 overflow-hidden transition-opacity ${
                          isActive ? "opacity-100" : "opacity-60 hover:opacity-100"
                        }`}
                        aria-label={`Show image ${i + 1}: ${img.alt}`}
                        aria-pressed={isActive}
                      >
                        <Image
                          src={img.url}
                          alt={img.alt}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </button>
                      <div
                        aria-hidden="true"
                        className={`h-[2px] w-20 transition-colors ${
                          isActive ? "bg-primary" : "bg-transparent"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
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
              {/* Payment + delivery logos sit inside hairline-bordered
                  trays with small-caps labels — frames the brand logos
                  as considered information rather than visual noise. */}
              <div className="mt-4 space-y-3">
                <div className="border border-border/60 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
                    Payment
                  </p>
                  <PaymentMethodDisplay />
                </div>
                <div className="border border-border/60 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
                    Delivery
                  </p>
                  <DeliveryMethodDisplay />
                </div>
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
                    onClick={() => {
                      setSelectedColor(c.color);
                      // Snap back to the colour-hero when picking a new colour
                      // so the user doesn't stay on the fabric close-up of the
                      // previous colour.
                      setActiveThumbIdx(null);
                    }}
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
                  ? "Available"
                  : selectedVariant.stock > 0
                    ? `${selectedVariant.stock} remaining`
                    : "Spoken for"}
              </p>
            )}

            {/* Reserve This Piece — squared button, no icon, small-caps
                tracked label so the primary action reads like the shop's
                voice rather than a generic e-commerce CTA. */}
            <Button
              size="lg"
              className="w-full h-12 text-sm tracking-[0.12em] uppercase rounded-none"
              onClick={handleAddToCart}
              disabled={
                !selectedVariant ||
                selectedVariant.stock === 0 ||
                addToCartMutation.isPending
              }
            >
              {addToCartMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : null}
              {addToCartMutation.isSuccess ? "Held for You" : "Reserve This Piece"}
            </Button>

            {addToCartMutation.error ? (
              <p className="text-sm text-destructive">
                {addToCartMutation.error.message}
              </p>
            ) : null}

            {/* Express checkout — Apple Pay / Klarna / Google Pay etc.
                Skips the cart and goes straight to a Kustom-hosted
                one-click payment for the just-selected variant. */}
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground text-center mb-2">
                — or express checkout —
              </p>
              <ExpressButtons
                variantName={product.name}
                variantSku={selectedVariant?.sku}
                unitPriceMinor={product.basePrice}
                quantity={quantity}
                countryCode={country.code}
              />
            </div>

            <Separator />

            {/* Notes — small-caps eyebrow + brass hairline, matching the
                rest of the PDP. Material label is now its own caps tag
                to the left of the value, like a swatch card. */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  Notes
                </h3>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              {product.material && (
                <p className="text-sm text-muted-foreground">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-foreground mr-2">
                    Cloth
                  </span>
                  {product.material}
                </p>
              )}
              {features.length > 0 && (
                <ul className="space-y-2">
                  {features.map((feature, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-3"
                    >
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-1" />
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
