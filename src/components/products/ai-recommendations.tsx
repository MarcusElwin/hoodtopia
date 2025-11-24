"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProductCard } from "./product-card";
import { trpc } from "@/lib/trpc";

const EXAMPLE_PROMPTS = [
  "I need a warm hoodie for hiking in cold weather",
  "Looking for something stylish for casual office wear",
  "Want a lightweight hoodie for summer evenings",
  "Need a durable hoodie for outdoor workouts",
];

export function AIRecommendations() {
  const [prompt, setPrompt] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const { data: allProducts } = trpc.products.list.useQuery();

  const recommendMutation = trpc.ai.recommend.useMutation({
    onSuccess: () => {
      setHasSearched(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || recommendMutation.isPending) return;

    recommendMutation.mutate({ query: prompt });
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    recommendMutation.mutate({ query: example });
  };

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
    <div className="space-y-8">
      {/* AI Prompt Input */}
      <div className="max-w-2xl mx-auto">
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI-Powered Recommendations</span>
          </div>
          <h2 className="text-2xl font-bold">
            Tell us what you&apos;re looking for
          </h2>
          <p className="text-muted-foreground">
            Describe your ideal hoodie and our AI will find the perfect match
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., I need a warm hoodie for hiking in cold weather..."
              className="min-h-[100px] pr-24 resize-none text-base"
              rows={3}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!prompt.trim() || recommendMutation.isPending}
              className="absolute bottom-3 right-3"
            >
              {recommendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Find
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Example Prompts */}
        {!hasSearched && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Try one of these examples:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExampleClick(example)}
                  className="text-xs"
                  disabled={recommendMutation.isPending}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {recommendMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            AI is finding the perfect hoodies for you...
          </p>
        </div>
      )}

      {hasSearched && !recommendMutation.isPending && (
        <div className="space-y-6">
          {recommendMutation.data?.followUpQuestion && (
            <div className="max-w-2xl mx-auto p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm">
                <Sparkles className="h-4 w-4 inline mr-2 text-primary" />
                {recommendMutation.data.followUpQuestion}
              </p>
            </div>
          )}

          {recommendedProducts.length > 0 ? (
            <>
              <h3 className="text-lg font-semibold">
                Recommended for you ({recommendedProducts.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendedProducts.map((product) => (
                  <div key={product!.id} className="space-y-3">
                    <ProductCard product={product!} />
                    <div className="px-2">
                      <p className="text-sm text-muted-foreground">
                        <Sparkles className="h-3 w-3 inline mr-1.5 text-primary" />
                        {(product as { reason: string }).reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
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
  );
}
