import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, inArray, ne } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { db, carts, products } from "@/db";
import { kustom } from "@/lib/kustom/client";
import { buildCreateOrderPayload } from "@/lib/kustom/cart-mapper";
import { currencySymbol } from "@/lib/kustom/currency";
import { getCartRecommendations } from "@/services/ai";

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
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cart is empty",
        });
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

  // Confirmation page details: line items + shipping address + totals.
  // Reads from the Checkout API directly (works immediately, no push delay).
  getConfirmationDetails: publicProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ input }) => {
      const order = await kustom.readOrder(input.orderId);
      return {
        order_id: order.order_id,
        status: order.status,
        purchase_currency: order.purchase_currency,
        order_amount: order.order_amount,
        order_tax_amount: order.order_tax_amount,
        order_lines: order.order_lines,
        billing_address: order.billing_address,
        shipping_address: order.shipping_address,
        selected_shipping_option: order.selected_shipping_option,
        completed_at: order.completed_at,
      };
    }),

  // Post-purchase cross-sell. Matches purchased line items back to local
  // products by SKU, then asks the AI for complementary recommendations.
  getPostPurchaseRecommendations: publicProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ input }) => {
      const order = await kustom.readOrder(input.orderId);
      const skus = (order.order_lines ?? [])
        .map((l) => l.reference)
        .filter((s): s is string => Boolean(s));

      if (skus.length === 0) {
        return { recommendations: [], cartAnalysis: "" };
      }

      const purchasedVariants = await db.query.productVariants.findMany({
        where: (v) => inArray(v.sku, skus),
        with: { product: true },
      });
      const purchasedProducts = Array.from(
        new Map(purchasedVariants.map((v) => [v.product.id, v.product])).values()
      );
      if (purchasedProducts.length === 0) {
        return { recommendations: [], cartAnalysis: "" };
      }

      const allProducts = await db.query.products.findMany({
        where: ne(products.category, "custom"),
        with: { variants: true },
      });

      return getCartRecommendations(purchasedProducts, allProducts, {
        currency: order.purchase_currency,
        symbol: currencySymbol(order.purchase_currency).trim(),
        budgetCap: 30,
      });
    }),
});
