"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, LayoutGrid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductFilters } from "@/components/products/product-filters";
import { AIRecommendations } from "@/components/products/ai-recommendations";
import { AIChatButton } from "@/components/ai/chat-button";
import { Skeleton } from "@/components/ui/skeleton";

function ProductsContent() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") === "ai" ? "ai" : "all";
  // Controlled so that deep-link ?tab=ai always wins over Suspense ordering;
  // local state still lets the user click between tabs without a URL change.
  const [tab, setTab] = useState(urlTab);
  const [category, setCategory] = useState<string | undefined>(undefined);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="all" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            All Products
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Picks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <ProductFilters
            category={category}
            onCategoryChange={setCategory}
          />
        </TabsContent>
      </div>

      <TabsContent value="all" className="mt-0">
        <ProductGrid category={category} />
      </TabsContent>

      <TabsContent value="ai" className="mt-0">
        <AIRecommendations />
      </TabsContent>
    </Tabs>
  );
}

function ProductsLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Shop Hoodies
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Find your perfect hoodie from our curated collection
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<ProductsLoading />}>
          <ProductsContent />
        </Suspense>
      </div>

      <AIChatButton />
    </div>
  );
}
