import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import {
  retrieveCart,
  addLineItem,
  updateLineItem,
  removeLineItem,
  applyPromo,
  removePromo,
} from "@/lib/commerce/medusa-cart";
import {
  DEMO_SESSION_ID,
  getOrCreateCartId,
  resetCart,
} from "@/lib/commerce/cart-session";
import { getCartRecommendations } from "@/services/ai";
import { listProducts, getProductById } from "@/lib/commerce/medusa-products";

/**
 * Cart router — now backed by a real MedusaJS cart instead of the Drizzle
 * carts/cartItems tables. Medusa owns line items, totals, and inventory
 * reservations, so the old manual adjustStock logic is gone (out-of-stock is
 * surfaced from Medusa). The Medusa cart id is persisted per demo session in
 * the medusa_carts table (see cart-session.ts); procedure signatures and the
 * returned cart shape are unchanged, so the cart UI is untouched.
 */
export const cartRouter = router({
  // Current cart with items + totals.
  get: publicProcedure
    .input(z.object({ currency: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID, input?.currency);
      const cart = await retrieveCart(cartId);
      // getOrCreateCartId guarantees the cart exists; null would mean a race —
      // return an empty cart shape rather than throwing.
      return (
        cart ?? {
          id: cartId,
          completedAt: null,
          items: [],
          subtotal: 0,
          discount: 0,
          total: 0,
          itemCount: 0,
          promoCodes: [],
        }
      );
    }),

  // Add a variant to the cart. Medusa reserves inventory and rejects if the
  // requested quantity isn't available.
  addItem: publicProcedure
    .input(
      z.object({
        // productId kept for input compatibility with the existing UI; Medusa
        // only needs the variant id.
        productId: z.string().optional(),
        variantId: z.string(),
        quantity: z.number().min(1).default(1),
        currency: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID, input.currency);
      try {
        await addLineItem(cartId, input.variantId, input.quantity);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            err instanceof Error && /stock|inventory|quantity/i.test(err.message)
              ? "Not enough stock for that quantity."
              : "Could not add that item to the cart.",
        });
      }
    }),

  // Update a line item's quantity (0 removes it).
  updateQuantity: publicProcedure
    .input(
      z.object({
        itemId: z.string(),
        quantity: z.number().min(0),
      })
    )
    .mutation(async ({ input }) => {
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID);
      try {
        if (input.quantity === 0) {
          await removeLineItem(cartId, input.itemId);
        } else {
          await updateLineItem(cartId, input.itemId, input.quantity);
        }
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            err instanceof Error && /stock|inventory|quantity/i.test(err.message)
              ? "Not enough stock for that quantity."
              : "Could not update the cart.",
        });
      }
    }),

  // Remove a line item.
  removeItem: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    const cartId = await getOrCreateCartId(DEMO_SESSION_ID);
    await removeLineItem(cartId, input);
    return { success: true };
  }),

  // Apply a promo code (Medusa promotion). Returns success + a message so the
  // UI can show "applied!" or the rejection reason.
  applyPromo: publicProcedure
    .input(z.object({ code: z.string().min(1).max(64) }))
    .mutation(async ({ input }) => {
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID);
      const res = await applyPromo(cartId, input.code.trim());
      return {
        success: res.applied,
        message: res.applied
          ? `Code ${input.code.trim().toUpperCase()} applied.`
          : res.error ?? "That code isn't valid.",
        discount: res.cart.discount,
        total: res.cart.total,
        promoCodes: res.cart.promoCodes,
      };
    }),

  // Remove an applied promo code.
  removePromo: publicProcedure
    .input(z.object({ code: z.string().min(1).max(64) }))
    .mutation(async ({ input }) => {
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID);
      const cart = await removePromo(cartId, input.code.trim());
      return { success: true, discount: cart.discount, total: cart.total, promoCodes: cart.promoCodes };
    }),

  // Clear the cart (user-initiated). Starting a fresh Medusa cart is the
  // simplest way to empty it and release any inventory reservations.
  clear: publicProcedure.mutation(async () => {
    await resetCart(DEMO_SESSION_ID);
    // Recreate immediately so the next get() has a cart ready.
    await getOrCreateCartId(DEMO_SESSION_ID);
    return { success: true };
  }),

  // Clear after a successful purchase. The Medusa cart that was paid for is
  // completed into an order in Phase 5; here we just drop the session pointer
  // so the shopper starts a new cart.
  clearAfterPurchase: publicProcedure.mutation(async () => {
    await resetCart(DEMO_SESSION_ID);
    return { success: true };
  }),

  // AI cross-sell recommendations based on the current cart's products.
  getRecommendations: publicProcedure
    .input(
      z
        .object({
          symbol: z.string().optional(),
          budgetCap: z.number().optional(),
          currency: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID, input?.currency);
      const cart = await retrieveCart(cartId);

      if (!cart || cart.items.length === 0) {
        return {
          recommendations: [],
          cartAnalysis:
            "Add items to your cart to see personalized recommendations.",
        };
      }

      // Resolve the full product records for the cart's line items + the whole
      // catalog (the AI service expects the legacy Product shape). Region-price
      // them so recommended-product cards match the active currency.
      const allProducts = await listProducts({ currencyCode: input?.currency });
      const cartProducts = (
        await Promise.all(
          cart.items.map((i) =>
            getProductById(i.productId, { currencyCode: input?.currency })
          )
        )
      ).filter((p): p is NonNullable<typeof p> => p !== null);

      return getCartRecommendations(cartProducts, allProducts, input);
    }),
});
