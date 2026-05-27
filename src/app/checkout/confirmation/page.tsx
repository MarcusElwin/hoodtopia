import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";
import { KustomSnippet } from "@/components/checkout/kustom-snippet";
import { OrderSummary } from "@/components/checkout/order-summary";
import { ClearCartOnMount } from "@/components/checkout/clear-cart-on-mount";
import { CopyOrderId } from "@/components/checkout/copy-order-id";
import { PostPurchaseRecommendations } from "@/components/checkout/post-purchase-recommendations";
import { Button } from "@/components/ui/button";
import { formatMinor } from "@/lib/kustom/currency";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ order_id?: string }>;
}

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const { order_id } = await searchParams;

  if (!order_id) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Missing order</h1>
        <p className="text-muted-foreground mb-6">
          No <code>order_id</code> in the URL. Did you arrive here from a
          completed checkout?
        </p>
        <Link href="/products">
          <Button>Back to shop</Button>
        </Link>
      </div>
    );
  }

  const ctx = await createTRPCContext({ headers: new Headers() });
  const caller = appRouter.createCaller(ctx);

  let html = "";
  let details: Awaited<
    ReturnType<typeof caller.checkout.getConfirmationDetails>
  > | null = null;
  let errorMessage = "";

  try {
    const [order, det] = await Promise.all([
      caller.checkout.getCheckoutOrder({ orderId: order_id }),
      caller.checkout.getConfirmationDetails({ orderId: order_id }),
    ]);
    html = order.html_snippet;
    details = det;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="min-h-screen">
      <ClearCartOnMount />

      {/* Hero */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-green-500/5 pointer-events-none" />
        <div className="container mx-auto px-4 py-10 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-11 w-11 rounded-full bg-green-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Thanks for your order!
                </h1>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-14">
                <span>Order</span>
                <CopyOrderId orderId={order_id} />
              </div>
            </div>
            {details ? (
              <div className="rounded-xl border bg-card px-5 py-4 sm:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Total paid
                </p>
                <p className="text-2xl font-bold">
                  {formatMinor(details.order_amount, details.purchase_currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  incl. {details.purchase_currency} VAT
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
        {errorMessage ? (
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">
              Couldn&apos;t load confirmation
            </h2>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto mb-4">
              {errorMessage}
            </pre>
          </div>
        ) : (
          <>
            {details ? (
              <OrderSummary
                currency={details.purchase_currency}
                lines={details.order_lines}
                shippingAddress={details.shipping_address}
                selectedShipping={details.selected_shipping_option}
              />
            ) : null}

            <section>
              <KustomSnippet html={html} />
            </section>

            <PostPurchaseRecommendations orderId={order_id} />
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-center pt-4">
          <Link href="/products">
            <Button size="lg" className="w-full sm:w-auto">
              Continue shopping
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
