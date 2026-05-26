import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";
import { KustomSnippet } from "@/components/checkout/kustom-snippet";
import { Button } from "@/components/ui/button";

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
  let errorMessage = "";
  try {
    const order = await caller.checkout.getCheckoutOrder({ orderId: order_id });
    html = order.html_snippet;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="min-h-screen">
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Thanks for your order!
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Order ID: <code>{order_id}</code>
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {errorMessage ? (
          <div className="max-w-2xl mx-auto rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-2">
              Couldn&apos;t load confirmation
            </h2>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto mb-4">
              {errorMessage}
            </pre>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <KustomSnippet html={html} />
          </div>
        )}
        <div className="text-center mt-8">
          <Link href="/products">
            <Button variant="outline">Continue shopping</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
