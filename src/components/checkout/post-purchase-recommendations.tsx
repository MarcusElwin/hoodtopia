"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/lib/currency";

interface Props {
  orderId: string;
}

export function PostPurchaseRecommendations({ orderId }: Props) {
  const { formatPrice } = useCurrency();
  const { data, isLoading } =
    trpc.checkout.getPostPurchaseRecommendations.useQuery({ orderId });

  if (!isLoading && (!data || data.recommendations.length === 0)) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">You might also like</h2>
      </div>
      {data?.cartAnalysis ? (
        <p className="text-sm text-muted-foreground mb-6">{data.cartAnalysis}</p>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.recommendations
            .filter((r) => r.product)
            .slice(0, 4)
            .map((r) => {
              const p = r.product!;
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="group rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-square bg-secondary">
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="font-medium text-sm line-clamp-1">{p.name}</h3>
                    <p className="text-sm font-semibold">
                      {formatPrice(p.basePrice)}
                    </p>
                    {r.reason ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {r.reason}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </section>
  );
}
