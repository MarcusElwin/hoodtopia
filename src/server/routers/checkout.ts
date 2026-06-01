import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { router, publicProcedure } from "../trpc";
import { kustom } from "@/lib/kustom/client";
import {
  buildCreateOrderPayload,
  buildExpressOrderPayload,
  type CartItemForKustom,
} from "@/lib/kustom/cart-mapper";
import { currencySymbol } from "@/lib/kustom/currency";
import { getCartRecommendations } from "@/services/ai";
import {
  DEMO_SESSION_ID,
  getOrCreateCartId,
} from "@/lib/commerce/cart-session";
import { retrieveCart } from "@/lib/commerce/medusa-cart";
import { listProducts } from "@/lib/commerce/medusa-products";
import { syncKustomOrder } from "@/lib/commerce/order-sync";

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
          // ISO 3166-1 alpha-2. Drives purchase_country / currency / locale / VAT.
          countryCode: z.string().length(2).optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      // Load the current Medusa cart and map its line items into the shape the
      // Kustom order builder expects. Kustom stays the payment step; only its
      // data source changed (Medusa cart instead of the old Drizzle cart).
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID);
      const cart = await retrieveCart(cartId);
      const items: CartItemForKustom[] = (cart?.items ?? []).map((i) => ({
        quantity: i.quantity,
        priceAtAdd: i.priceAtAdd,
        product: { name: i.product.name, imageUrl: i.product.imageUrl },
        variant: {
          sku: i.variant.sku,
          color: i.variant.color,
          size: i.variant.size,
          imageUrl: i.variant.imageUrl,
        },
      }));

      if (items.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cart is empty",
        });
      }

      // Trace id is per-create-order so we can find this exact session in
      // logs even if multiple orders share the same sessionId.
      const traceId = uuidv4();
      const payload = buildCreateOrderPayload({
        items,
        siteUrl: siteUrl(),
        enableShippingAssistant: input?.enableShippingAssistant ?? true,
        countryCode: input?.countryCode,
        sessionId: DEMO_SESSION_ID,
        traceId,
      });

      console.log("[checkout/init] traceId=%s sessionId=%s country=%s items=%d",
        traceId, DEMO_SESSION_ID, input?.countryCode ?? "(default)", items.length);

      const order = await kustom.createOrder(payload);

      console.log("[checkout/init] traceId=%s order_id=%s status=%s",
        traceId, order.order_id, order.status);

      return {
        order_id: order.order_id,
        html_snippet: order.html_snippet ?? "",
        status: order.status,
        trace_id: traceId,
      };
    }),

  // Express checkout — synthesise a Kustom Checkout order from raw lines
  // (typically the selected variant on a PDP, or a snapshot of the cart).
  // Invoked from the Express Buttons createOrder hook so we wire our own
  // merchant_urls (confirmation + push) into the Kustom session. Returns
  // the order_id so the SDK can take over and finish the payment.
  initExpressCheckout: publicProcedure
    .input(
      z.object({
        lines: z
          .array(
            z.object({
              sku: z.string().min(1).max(64),
              name: z.string().min(1).max(255),
              unitPriceMinor: z.number().int().nonnegative(),
              quantity: z.number().int().min(1).max(99),
              imageUrl: z.string().max(1024).optional(),
            })
          )
          .min(1)
          .max(50),
        countryCode: z.string().length(2).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const traceId = uuidv4();
      const payload = buildExpressOrderPayload({
        lines: input.lines,
        siteUrl: siteUrl(),
        countryCode: input.countryCode,
        sessionId: DEMO_SESSION_ID,
        traceId,
      });

      console.log("[express/init] traceId=%s country=%s lines=%d total=%d %s",
        traceId, input.countryCode ?? "(default)", input.lines.length,
        payload.order_amount, payload.purchase_currency);

      const order = await kustom.createOrder(payload);

      console.log("[express/init] traceId=%s order_id=%s status=%s",
        traceId, order.order_id, order.status);

      return {
        order_id: order.order_id,
        status: order.status,
        trace_id: traceId,
      };
    }),

  // Instant order sync for the confirmation page. The Kustom push webhook is
  // async (~2 min); the confirmation page calls this right after payment so the
  // Medusa order appears immediately. Idempotent — safe to call alongside push.
  syncOrder: publicProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const result = await syncKustomOrder(input.orderId);
        return result;
      } catch (err) {
        console.error("[checkout/syncOrder] failed", err);
        return {
          status: "skipped" as const,
          reason: err instanceof Error ? err.message : "sync failed",
        };
      }
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

      // Match the purchased SKUs back to Medusa products (the whole catalog is
      // small, so fetch once and filter in memory).
      const skuSet = new Set(skus);
      const allProducts = await listProducts();
      const purchasedProducts = allProducts.filter((p) =>
        p.variants.some((v) => skuSet.has(v.sku))
      );
      if (purchasedProducts.length === 0) {
        return { recommendations: [], cartAnalysis: "" };
      }

      return getCartRecommendations(purchasedProducts, allProducts, {
        symbol: currencySymbol(order.purchase_currency).trim(),
        budgetCap: 30,
      });
    }),
});
