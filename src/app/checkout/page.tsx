import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";
import { KustomSnippet } from "@/components/checkout/kustom-snippet";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const ctx = await createTRPCContext({ headers: new Headers() });
  const caller = appRouter.createCaller(ctx);

  let html = "";
  let errorMessage = "";

  try {
    const result = await caller.checkout.initCheckout();
    html = result.html_snippet;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

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
            <Link href="/cart">
              <Button variant="outline">Back to cart</Button>
            </Link>
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
