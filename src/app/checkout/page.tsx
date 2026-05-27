"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { KustomSnippet } from "@/components/checkout/kustom-snippet";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/lib/currency";

// Client component so we can read the active country from useCurrency() and
// pass it to initCheckout. The Kustom payload's purchase_country drives the
// payment-methods + shipping zone Kustom renders inside the iframe.
export default function CheckoutPage() {
  const { country } = useCurrency();
  const [html, setHtml] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  const init = trpc.checkout.initCheckout.useMutation();
  const lastFiredFor = useRef<string | null>(null);

  useEffect(() => {
    // Re-init on country change OR retry click. Clear html so the iframe is
    // not left rendering the previous market's session while the new one loads.
    const key = `${country.code}:${attempt}`;
    if (lastFiredFor.current === key) return;
    lastFiredFor.current = key;

    setHtml("");
    setErrorMessage("");
    init
      .mutateAsync({ countryCode: country.code })
      .then((res) => setHtml(res.html_snippet))
      .catch((err) =>
        setErrorMessage(err instanceof Error ? err.message : String(err))
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.code, attempt]);

  const isLoading = init.isPending || (!html && !errorMessage);

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <Link
            href="/cart"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to cart
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Checkout
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Shipping to <span className="font-medium">{country.flag} {country.name}</span> ·
            paying in <span className="font-medium">{country.currency}</span>
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {errorMessage ? (
          <div className="max-w-2xl mx-auto rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">
              Checkout unavailable
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              We couldn&apos;t start a Kustom checkout session. Make sure your
              Playground credentials are set in <code>.env.local</code> and
              your cart has items.
            </p>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto mb-4">
              {errorMessage}
            </pre>
            <div className="flex gap-3">
              <Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
              <Link href="/cart">
                <Button variant="outline">Back to cart</Button>
              </Link>
            </div>
          </div>
        ) : isLoading ? (
          <div className="max-w-3xl mx-auto flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Preparing your checkout…
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <KustomSnippet html={html} />
          </div>
        )}
      </div>
    </div>
  );
}
