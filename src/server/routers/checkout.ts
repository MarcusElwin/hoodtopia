import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { db, carts } from "@/db";
import { kustom } from "@/lib/kustom/client";
import { buildCreateOrderPayload } from "@/lib/kustom/cart-mapper";

const DEMO_SESSION_ID = "demo-session";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export const checkoutRouter = router({
  // Initialize a Kustom checkout from the current cart. Returns html_snippet for embedding.
  initCheckout: publicProcedure
    .input(
      z
        .object({
          enableShippingAssistant: z.boolean().optional().default(true),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const cart = await db.query.carts.findFirst({
        where: eq(carts.sessionId, DEMO_SESSION_ID),
        with: {
          items: {
            with: {
              product: true,
              variant: true,
            },
          },
        },
      });

      const items = cart?.items ?? [];
      if (items.length === 0) {
        throw new Error("Cart is empty");
      }

      const payload = buildCreateOrderPayload({
        items,
        siteUrl: siteUrl(),
        enableShippingAssistant: input?.enableShippingAssistant ?? true,
      });

      const order = await kustom.createOrder(payload);
      return {
        order_id: order.order_id,
        html_snippet: order.html_snippet ?? "",
        status: order.status,
      };
    }),

  // Read an order's current state. On checkout_complete, html_snippet contains the confirmation iframe.
  getCheckoutOrder: publicProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ input }) => {
      const order = await kustom.readOrder(input.orderId);
      return {
        order_id: order.order_id,
        status: order.status,
        html_snippet: order.html_snippet ?? "",
        billing_address: order.billing_address,
        order_amount: order.order_amount,
        purchase_currency: order.purchase_currency,
      };
    }),
});
