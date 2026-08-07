"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { inferRouterOutputs } from "@trpc/server";
import { Sparkles, Send, Loader2, ThumbsUp, ThumbsDown, ShoppingCart, Check, GitCompare, Save, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/lib/currency";
import { useBrowseHistory } from "@/hooks/use-browse-history";
import type { AppRouter } from "@/server/root";
import { ProductComparison } from "./product-comparison";

type ProductItem = inferRouterOutputs<AppRouter>["products"]["list"][number];
type VariantItem = ProductItem["variants"][number];

const EXAMPLE_PROMPTS = [
  "I need a warm hoodie for hiking in cold weather",
  "Looking for something stylish for casual office wear",
  "Want a lightweight hoodie for summer evenings",
  "Need a durable hoodie for outdoor workouts",
];

const PLACEHOLDER_PROMPTS = [
  "warm hoodie for winter hiking...",
  "stylish casual office wear...",
  "lightweight summer evening hoodie...",
  "durable outdoor workout gear...",
  "cozy oversized hoodie...",
  "sleek modern streetwear...",
];

export function AIRecommendations() {
  const [prompt, setPrompt] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [addedToCartId, setAddedToCartId] = useState<string | null>(null);
  // Track selections per product: { productId: { color, size } }
  const [selections, setSelections] = useState<Record<string, { color: string | null; size: string | null }>>({});
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  // Track products selected for comparison
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const { formatMoney, currency } = useCurrency();
  const { data: allProducts } = trpc.products.list.useQuery({
    currency: currency.code,
  });
  const { getPersonalizationContext } = useBrowseHistory();
  const utils = trpc.useUtils();

  // Load saved preferences on mount
  const { data: savedPreferences } = trpc.preferences.get.useQuery();

  const savePreferencesMutation = trpc.preferences.save.useMutation({
    onSuccess: () => {
      utils.preferences.get.invalidate();
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    },
  });

  // Cycle through placeholder prompts with animation
  useEffect(() => {
    if (hasSearched || prompt.length > 0) return;

    const interval = setInterval(() => {
      setCurrentPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_PROMPTS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [hasSearched, prompt]);

  const addToCartMutation = trpc.cart.addItem.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      // Reset success state after 2 seconds
      setTimeout(() => setAddedToCartId(null), 2000);
    },
  });

  const recommendMutation = trpc.ai.recommend.useMutation({
    onSuccess: () => {
      setHasSearched(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || recommendMutation.isPending) return;

    setConversationHistory([...conversationHistory, prompt]);

    // Get personalization context from browse history
    const personalizationContext = getPersonalizationContext();

    recommendMutation.mutate({
      preferences: prompt,
      personalizationContext,
      currency: currency.code,
    });
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    setConversationHistory([example]);

    // Get personalization context from browse history
    const personalizationContext = getPersonalizationContext();

    recommendMutation.mutate({
      preferences: example,
      personalizationContext,
      currency: currency.code,
    });
  };

  const handleRefinement = (feedback: string) => {
    if (!feedback.trim() || recommendMutation.isPending) return;

    const refinementPrompt = `${conversationHistory.join(" → ")} → ${feedback}`;
    setConversationHistory([...conversationHistory, feedback]);

    // Get personalization context from browse history
    const personalizationContext = getPersonalizationContext();

    recommendMutation.mutate({
      preferences: refinementPrompt,
      personalizationContext,
      currency: currency.code,
    });
  };

  const handleColorSelect = (productId: string, color: string) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        color,
      },
    }));
  };

  const handleSizeSelect = (productId: string, size: string) => {
    setSelections((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        size,
      },
    }));
  };

  const getSelectedVariant = (product: ProductItem) => {
    const selection = selections[product.id];
    if (!selection?.color || !selection?.size) {
      // Return first variant as default
      return product.variants?.[0];
    }

    return product.variants.find(
      (v: VariantItem) => v.color === selection.color && v.size === selection.size
    );
  };

  const handleAddToCart = (product: ProductItem) => {
    // Get selected variant
    const selectedVariant = getSelectedVariant(product);

    if (!selectedVariant) {
      console.error("No variant selected for product:", product.name);
      return;
    }

    setAddedToCartId(product.id);

    addToCartMutation.mutate({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity: 1,
      currency: currency.code,
    });
  };

  const handleQuickFeedback = (type: "positive" | "negative", productName: string) => {
    const feedbackText =
      type === "positive"
        ? `I like ${productName}, show me more like this`
        : `Not interested in ${productName}, show me different options`;
    handleRefinement(feedbackText);
  };

  const toggleProductForComparison = (productId: string) => {
    setSelectedForComparison((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        // Limit to 3 products
        if (newSet.size >= 3) {
          return prev;
        }
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleCompare = () => {
    if (selectedForComparison.size >= 2) {
      setShowComparison(true);
    }
  };

  const handleSavePreferences = () => {
    if (!prompt.trim()) return;

    savePreferencesMutation.mutate({
      preferences: conversationHistory.join(" → ") || prompt,
    });
  };

  // Pre-fill prompt from saved preferences on mount. Syncing local state from
  // a server query is a valid effect use; the lint rule flags the setState.
  useEffect(() => {
    if (savedPreferences && !hasSearched && !prompt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrompt(savedPreferences.preferences.description);
    }
  }, [savedPreferences, hasSearched, prompt]);

  // Get recommended products
  const recommendedProducts =
    recommendMutation.data?.recommendations
      .map((rec) => {
        const product = allProducts?.find((p) =>
          p.name.toLowerCase().includes(rec.productName.toLowerCase())
        );
        return product ? { ...product, reason: rec.reason } : null;
      })
      .filter(Boolean) || [];

  return (
    <>
      <style jsx global>{`
        @keyframes gradient-flow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes sparkle-pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.1) rotate(10deg);
          }
        }
      `}</style>
      <div className="space-y-6">
        {/* Compact Header */}
        <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI-Powered Recommendations</span>
        </div>
        <h2 className="text-xl font-bold">
          What are you looking for?
        </h2>
      </div>

      {/* Unified Input/Refinement Area */}
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <div className="relative">
              {/* Animated gradient placeholder */}
              {!prompt && !hasSearched && (
                <div className="absolute inset-0 flex items-start gap-2 px-3 py-2 pointer-events-none transition-opacity duration-500">
                  {/* Animated Sparkles icon */}
                  <Sparkles
                    className="h-4 w-4 mt-0.5 flex-shrink-0"
                    style={{
                      animation: "sparkle-pulse 2s ease-in-out infinite",
                      color: "#a78bfa",
                    }}
                  />
                  <span
                    className="text-sm"
                    style={{
                      background: "linear-gradient(90deg, rgba(156,163,175,0.8) 0%, rgba(167,139,250,0.9) 50%, rgba(156,163,175,0.8) 100%)",
                      backgroundSize: "200% 100%",
                      animation: "gradient-flow 3s ease infinite",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {PLACEHOLDER_PROMPTS[currentPlaceholderIndex]}
                  </span>
                </div>
              )}
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  hasSearched
                    ? "Refine your search: e.g., warmer colors, more casual, better for winter..."
                    : ""
                }
                className="min-h-[80px] pr-24 resize-none relative bg-transparent"
                rows={2}
                disabled={recommendMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!prompt.trim() || recommendMutation.isPending}
              className="absolute bottom-2 right-2"
            >
              {recommendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  {hasSearched ? "Refine" : "Find"}
                </>
              )}
            </Button>
          </div>

          {/* Loading indicator right below input */}
          {recommendMutation.isPending && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 bg-primary/5 rounded-lg border border-primary/20">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {hasSearched ? "Refining recommendations..." : `AI is analyzing ${allProducts?.length || 0} products...`}
              </p>
            </div>
          )}

          {/* Show conversation history when refining */}
          {hasSearched && conversationHistory.length > 0 && !recommendMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
              <span className="font-medium">Your search:</span>
              <span className="truncate italic">{conversationHistory.slice(-1)[0]}</span>
              {conversationHistory.length > 1 && (
                <span className="text-primary">• Refinement #{conversationHistory.length - 1}</span>
              )}
            </div>
          )}
        </form>

        {/* Compact Example Prompts - Only show when not searched */}
        {!hasSearched && !recommendMutation.isPending && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Quick searches:
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {EXAMPLE_PROMPTS.map((example) => (
                <Button
                  key={example}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExampleClick(example)}
                  className="text-xs h-7 px-3"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Section - Compact */}
      {hasSearched && !recommendMutation.isPending && (
        <div className="space-y-4">
          {/* Follow-up question - compact */}
          {recommendMutation.data?.followUpQuestion && (
            <div className="max-w-2xl mx-auto p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-sm flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{recommendMutation.data.followUpQuestion}</span>
              </p>
            </div>
          )}

          {recommendedProducts.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  Recommended for you ({recommendedProducts.length})
                </h3>
                <div className="flex gap-2">
                  {/* Save Preferences Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSavePreferences}
                    disabled={savePreferencesMutation.isPending || !prompt.trim()}
                    className="gap-2"
                  >
                    {showSaveSuccess ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 text-green-500" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Preferences
                      </>
                    )}
                  </Button>

                  {/* Compare Button */}
                  {selectedForComparison.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCompare}
                      disabled={selectedForComparison.size < 2}
                      className="gap-2"
                    >
                      <GitCompare className="h-4 w-4" />
                      Compare ({selectedForComparison.size})
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendedProducts.map((product) => {
                  // Skip if no variants
                  if (!product!.variants || product!.variants.length === 0) {
                    console.error("No variants for product:", product!.name);
                    return null;
                  }

                  // Get unique colors and sizes for this product
                  const colors = product!.variants.reduce(
                    (acc: { color: string; colorHex: string }[], v: VariantItem) => {
                      if (!acc.find((c) => c.color === v.color)) {
                        acc.push({ color: v.color, colorHex: v.colorHex });
                      }
                      return acc;
                    },
                    []
                  );
                  const sizes = [...new Set(product!.variants.map((v: VariantItem) => v.size))];
                  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
                  const sortedSizes = sizes.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));

                  const selection = selections[product!.id] || { color: colors[0]?.color, size: sortedSizes[0] };
                  const selectedColor = selection.color || colors[0]?.color;
                  const selectedSize = selection.size || sortedSizes[0];
                  const isAdded = addedToCartId === product!.id;

                  // Get the image for the selected color
                  const selectedVariant = product!.variants.find(
                    (v: VariantItem) => v.color === selectedColor
                  );
                  const displayImage = selectedVariant?.imageUrl || product!.imageUrl;

                  return (
                    <div key={product!.id} className="space-y-2 relative">
                      {/* Comparison Checkbox */}
                      <div className="absolute top-2 right-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedForComparison.has(product!.id)}
                          onChange={() => toggleProductForComparison(product!.id)}
                          className="h-5 w-5 rounded border-2 border-background shadow-lg cursor-pointer accent-primary"
                          title="Select for comparison"
                        />
                      </div>

                      {/* Custom Product Image that updates with color selection */}
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary/50">
                        <Image
                          src={displayImage}
                          alt={`${product!.name} - ${selectedColor}`}
                          fill
                          className="object-cover transition-all duration-300"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          key={displayImage} // Force re-render on image change
                        />
                        {product!.featured && (
                          <div className="absolute top-3 left-3">
                            <span className="bg-primary px-2 py-1 text-xs font-medium text-primary-foreground rounded">
                              Featured
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="px-2">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-medium text-sm leading-tight">{product!.name}</h3>
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {formatMoney(product!.basePrice)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize mb-2">
                          {product!.category}
                        </p>
                      </div>

                      <div className="px-2 space-y-2">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
                          {(product as { reason: string }).reason}
                        </p>

                        {/* Color Selection */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Color</span>
                            <span className="text-xs text-muted-foreground capitalize">{selectedColor}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {colors.map((c) => (
                              <button
                                key={c.color}
                                onClick={() => handleColorSelect(product!.id, c.color)}
                                className={`relative h-6 w-6 rounded-full border transition-all ${
                                  selectedColor === c.color
                                    ? "border-primary ring-1 ring-primary ring-offset-1"
                                    : "border-border hover:border-foreground/50"
                                }`}
                                style={{ backgroundColor: c.colorHex }}
                                title={c.color}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Size Selection */}
                        <div className="space-y-1">
                          <span className="text-xs font-medium">Size</span>
                          <div className="flex flex-wrap gap-1">
                            {sortedSizes.map((size) => (
                              <button
                                key={size}
                                onClick={() => handleSizeSelect(product!.id, size)}
                                className={`h-6 min-w-[32px] px-2 rounded text-xs font-medium transition-all ${
                                  selectedSize === size
                                    ? "border border-primary bg-primary text-primary-foreground"
                                    : "border border-border hover:border-foreground/50"
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Add to Cart button */}
                        <Button
                          className="w-full h-8 text-xs"
                          onClick={() => handleAddToCart(product!)}
                          disabled={addToCartMutation.isPending && addedToCartId === product!.id}
                        >
                          {addToCartMutation.isPending && addedToCartId === product!.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : isAdded ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : (
                            <ShoppingCart className="h-3 w-3 mr-1" />
                          )}
                          {isAdded ? "Added!" : "Add to Cart"}
                        </Button>

                        {/* Quick feedback buttons */}
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs flex-1"
                            onClick={() => handleQuickFeedback("positive", product!.name)}
                            disabled={recommendMutation.isPending}
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            More
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs flex-1"
                            onClick={() => handleQuickFeedback("negative", product!.name)}
                            disabled={recommendMutation.isPending}
                          >
                            <ThumbsDown className="h-3 w-3 mr-1" />
                            Different
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No matching products found. Try a different description!
              </p>
            </div>
          )}
        </div>
      )}

      {recommendMutation.isError && (
        <div className="text-center py-8">
          <p className="text-destructive">
            Something went wrong. Please try again.
          </p>
        </div>
      )}
      </div>

      {/* Product Comparison Modal */}
      {showComparison && (
        <ProductComparison
          products={recommendedProducts
            .filter((p): p is NonNullable<typeof p> => p !== null && selectedForComparison.has(p.id))}
          onClose={() => setShowComparison(false)}
          aiInsight={
            recommendedProducts.length > 0
              ? `Based on your preferences, here's how these ${selectedForComparison.size} products compare. Each has unique features suited to different needs.`
              : undefined
          }
        />
      )}
    </>
  );
}
