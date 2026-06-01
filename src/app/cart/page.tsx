"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Minus, Plus, Trash2, ShoppingBag, Loader2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/lib/currency";
import { CartRecommendations } from "@/components/cart/cart-recommendations";
import { PaymentMethodDisplay } from "@/components/kustom/payment-method-display";
import { ExpressButtons } from "@/components/kustom/express-buttons";
import { track } from "@/lib/analytics";

export default function CartPage() {
  const utils = trpc.useUtils();
  const { data: cart, isLoading } = trpc.cart.get.useQuery();
  const { formatPrice } = useCurrency();

  const invalidateCartAndProducts = () => {
    utils.cart.get.invalidate();
    utils.products.invalidate();
  };

  const updateQuantityMutation = trpc.cart.updateQuantity.useMutation({
    onSuccess: invalidateCartAndProducts,
  });

  const removeItemMutation = trpc.cart.removeItem.useMutation({
    // Capture the snapshot BEFORE invalidating — once the cache refetches,
    // `items` will exclude the removed row and the lookup would return
    // undefined, silently skipping the analytics event.
    onSuccess: (_, itemId) => {
      const removed = items.find((i) => i.id === itemId);
      if (removed) {
        track("remove_from_cart", {
          variantSku: removed.variant.sku,
          quantity: removed.quantity,
        });
      }
      invalidateCartAndProducts();
    },
  });

  const clearCartMutation = trpc.cart.clear.useMutation({
    onSuccess: invalidateCartAndProducts,
  });

  const [promoInput, setPromoInput] = useState("");
  const [promoMessage, setPromoMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const applyPromoMutation = trpc.cart.applyPromo.useMutation({
    onSuccess: (res) => {
      setPromoMessage({ ok: res.success, text: res.message });
      if (res.success) setPromoInput("");
      utils.cart.get.invalidate();
    },
  });

  const removePromoMutation = trpc.cart.removePromo.useMutation({
    onSuccess: () => {
      setPromoMessage(null);
      utils.cart.get.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const items = cart?.items || [];
  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <Link
            href="/products"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Continue Shopping
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Your Cart
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isEmpty ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">
              Looks like you haven&apos;t added any hoodies yet.
            </p>
            <Link href="/products">
              <Button size="lg">Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 rounded-lg border bg-card"
                >
                  {/* Product Image */}
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-secondary"
                  >
                    <Image
                      src={item.variant.imageUrl || item.product.imageUrl}
                      alt={`${item.product.name} - ${item.variant.color}`}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </Link>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="font-medium hover:text-primary transition-colors line-clamp-1"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.variant.color} / {item.variant.size}
                    </p>
                    <p className="font-semibold mt-2">
                      {formatPrice(item.priceAtAdd)}
                    </p>
                  </div>

                  {/* Quantity & Actions */}
                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItemMutation.mutate(item.id)}
                      disabled={removeItemMutation.isPending}
                    >
                      {removeItemMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantityMutation.mutate({
                            itemId: item.id,
                            quantity: Math.max(0, item.quantity - 1),
                          })
                        }
                        disabled={updateQuantityMutation.isPending}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantityMutation.mutate({
                            itemId: item.id,
                            quantity: item.quantity + 1,
                          })
                        }
                        disabled={
                          updateQuantityMutation.isPending || item.quantity >= 10
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Clear Cart */}
              <div className="pt-4">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => clearCartMutation.mutate()}
                  disabled={clearCartMutation.isPending}
                >
                  {clearCartMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Cart
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="rounded-lg border bg-card p-6 sticky top-24">
                <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Subtotal ({cart?.itemCount} items)
                    </span>
                    <span>{formatPrice(cart?.subtotal || 0)}</span>
                  </div>
                  {(cart?.discount ?? 0) > 0 && (
                    <div className="flex justify-between text-green-500">
                      <span>
                        Discount
                        {cart?.promoCodes?.length
                          ? ` (${cart.promoCodes.join(", ")})`
                          : ""}
                      </span>
                      <span>−{formatPrice(cart?.discount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-green-500">Free</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>

                {/* Promo code */}
                {!isEmpty && (
                  <div className="mt-4">
                    {cart?.promoCodes?.length ? (
                      <div className="space-y-2">
                        {cart.promoCodes.map((code) => (
                          <div
                            key={code}
                            className="flex items-center justify-between rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm"
                          >
                            <span className="flex items-center gap-2 text-green-500">
                              <Tag className="h-3.5 w-3.5" />
                              {code}
                            </span>
                            <button
                              onClick={() =>
                                removePromoMutation.mutate({ code })
                              }
                              disabled={removePromoMutation.isPending}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${code}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            value={promoInput}
                            onChange={(e) => {
                              setPromoInput(e.target.value);
                              setPromoMessage(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && promoInput.trim()) {
                                applyPromoMutation.mutate({ code: promoInput });
                              }
                            }}
                            placeholder="Promo code"
                            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm uppercase placeholder:normal-case placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            variant="outline"
                            onClick={() =>
                              applyPromoMutation.mutate({ code: promoInput })
                            }
                            disabled={
                              !promoInput.trim() || applyPromoMutation.isPending
                            }
                          >
                            {applyPromoMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Apply"
                            )}
                          </Button>
                        </div>
                        {promoMessage && (
                          <p
                            className={`text-xs ${promoMessage.ok ? "text-green-500" : "text-destructive"}`}
                          >
                            {promoMessage.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Separator className="my-4" />

                <div className="flex justify-between text-lg font-semibold mb-6">
                  <span>Total</span>
                  <span>
                    {formatPrice(
                      (cart?.total ?? cart?.subtotal) || 0
                    )}
                  </span>
                </div>

                <Button
                  asChild={!isEmpty}
                  className="w-full h-12 text-base"
                  size="lg"
                  disabled={isEmpty}
                >
                  {isEmpty ? (
                    <span>Proceed to Checkout</span>
                  ) : (
                    <Link href="/checkout">Proceed to Checkout</Link>
                  )}
                </Button>

                {/* Express checkout below the main CTA — Apple Pay, Klarna,
                    Google Pay etc. Skips the full checkout iframe. */}
                {!isEmpty && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground text-center mb-2">
                      — or express checkout —
                    </p>
                    <ExpressButtons
                      lines={items.map((it) => ({
                        name: `${it.product.name} — ${it.variant.color}, ${it.variant.size}`,
                        sku: it.variant.sku,
                        unitPriceMinor: it.priceAtAdd,
                        quantity: it.quantity,
                      }))}
                    />
                  </div>
                )}

                <div className="mt-4">
                  <PaymentMethodDisplay />
                </div>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  This is a demo. No real transactions will be processed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Cart Recommendations */}
        {!isEmpty && (
          <div className="mt-8 lg:max-w-[66.666667%]">
            <CartRecommendations />
          </div>
        )}
      </div>
    </div>
  );
}
