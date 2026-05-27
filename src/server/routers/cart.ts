import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, ne, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { router, publicProcedure } from "../trpc";
import { db, carts, cartItems, products, productVariants } from "@/db";
import { getCartRecommendations } from "@/services/ai";

// For demo purposes, we use a fixed session ID
// In production, you'd get this from cookies/auth
const DEMO_SESSION_ID = "demo-session";

// Carts idle longer than this are treated as a new session and auto-cleared.
// Keeps the demo state fresh between attendees / browser sessions.
const CART_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Atomic stock delta. The libSQL driver reports rowsAffected=0 when the WHERE
// clause rejects (stock would go negative), which we surface as a clean
// out-of-stock error instead of a silent no-op.
async function adjustStock(variantId: string, delta: number) {
  if (delta === 0) return;
  const stmt =
    delta < 0
      ? db
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${delta}` })
          .where(
            and(
              eq(productVariants.id, variantId),
              sql`${productVariants.stock} + ${delta} >= 0`
            )
          )
      : db
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${delta}` })
          .where(eq(productVariants.id, variantId));

  const result = await stmt.run();
  if (delta < 0 && result.rowsAffected === 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Not enough stock for that quantity.",
    });
  }
}

export const cartRouter = router({
  // Get current cart with items
  get: publicProcedure.query(async () => {
    // Find or create cart for session
    let cart = await db.query.carts.findFirst({
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

    // Auto-clear stale sessions so each demo run starts fresh.
    if (
      cart &&
      cart.items.length > 0 &&
      Date.now() - cart.updatedAt.getTime() > CART_SESSION_TTL_MS
    ) {
      // Restore stock for everything we're about to drop.
      for (const item of cart.items) {
        await adjustStock(item.variantId, item.quantity);
      }
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      cart = { ...cart, items: [] };
    }

    if (!cart) {
      const cartId = uuidv4();
      await db.insert(carts).values({
        id: cartId,
        sessionId: DEMO_SESSION_ID,
      });

      cart = await db.query.carts.findFirst({
        where: eq(carts.id, cartId),
        with: {
          items: {
            with: {
              product: true,
              variant: true,
            },
          },
        },
      });
    }

    // Calculate totals
    const items = cart?.items || [];
    const subtotal = items.reduce(
      (sum, item) => sum + item.priceAtAdd * item.quantity,
      0
    );
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...cart,
      subtotal,
      itemCount,
    };
  }),

  // Add item to cart
  addItem: publicProcedure
    .input(
      z.object({
        productId: z.string(),
        variantId: z.string(),
        quantity: z.number().min(1).default(1),
      })
    )
    .mutation(async ({ input }) => {
      // Get or create cart
      let cart = await db.query.carts.findFirst({
        where: eq(carts.sessionId, DEMO_SESSION_ID),
      });

      if (!cart) {
        const cartId = uuidv4();
        await db.insert(carts).values({
          id: cartId,
          sessionId: DEMO_SESSION_ID,
        });
        cart = await db.query.carts.findFirst({
          where: eq(carts.id, cartId),
        });
      }

      if (!cart) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create cart",
        });
      }

      // Get product price
      const product = await db.query.products.findFirst({
        where: eq(products.id, input.productId),
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      // Atomic stock decrement — throws CONFLICT if insufficient.
      await adjustStock(input.variantId, -input.quantity);

      // Check if item already exists in cart
      const existingItem = await db.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.variantId, input.variantId)
        ),
      });

      if (existingItem) {
        // Update quantity
        await db
          .update(cartItems)
          .set({ quantity: existingItem.quantity + input.quantity })
          .where(eq(cartItems.id, existingItem.id));
      } else {
        // Add new item
        await db.insert(cartItems).values({
          id: uuidv4(),
          cartId: cart.id,
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity,
          priceAtAdd: product.basePrice,
        });
      }

      // Update cart timestamp
      await db
        .update(carts)
        .set({ updatedAt: new Date() })
        .where(eq(carts.id, cart.id));

      return { success: true };
    }),

  // Update item quantity
  updateQuantity: publicProcedure
    .input(
      z.object({
        itemId: z.string(),
        quantity: z.number().min(0),
      })
    )
    .mutation(async ({ input }) => {
      const item = await db.query.cartItems.findFirst({
        where: eq(cartItems.id, input.itemId),
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cart item not found" });
      }

      const delta = input.quantity - item.quantity;
      if (delta === 0) return { success: true };

      // Move stock to match the new quantity. Negative delta = need more stock.
      await adjustStock(item.variantId, -delta);

      if (input.quantity === 0) {
        await db.delete(cartItems).where(eq(cartItems.id, input.itemId));
      } else {
        await db
          .update(cartItems)
          .set({ quantity: input.quantity })
          .where(eq(cartItems.id, input.itemId));
      }

      return { success: true };
    }),

  // Remove item from cart
  removeItem: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    const item = await db.query.cartItems.findFirst({
      where: eq(cartItems.id, input),
    });
    if (item) {
      await adjustStock(item.variantId, item.quantity);
      await db.delete(cartItems).where(eq(cartItems.id, input));
    }
    return { success: true };
  }),

  // Clear entire cart (user-initiated — restores stock since items weren't bought).
  clear: publicProcedure.mutation(async () => {
    const cart = await db.query.carts.findFirst({
      where: eq(carts.sessionId, DEMO_SESSION_ID),
      with: { items: true },
    });

    if (cart) {
      for (const item of cart.items) {
        await adjustStock(item.variantId, item.quantity);
      }
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    }

    return { success: true };
  }),

  // Clear cart after a successful purchase — items already left inventory at
  // add-to-cart time, so we DO NOT restore stock here.
  clearAfterPurchase: publicProcedure.mutation(async () => {
    const cart = await db.query.carts.findFirst({
      where: eq(carts.sessionId, DEMO_SESSION_ID),
    });
    if (cart) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    }
    return { success: true };
  }),

  // Get AI-powered cart recommendations. The caller passes the active
  // currency symbol so the prompt + cartAnalysis text use the right glyph
  // ("under 300 kr" instead of "under $30" when the shopper is in SEK).
  // budgetCap is in the same currency's minor-unit major number (e.g. 300
  // for "300 kr" or "£300"), not converted between currencies.
  getRecommendations: publicProcedure
    .input(
      z
        .object({
          symbol: z.string().optional(),
          budgetCap: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      // Get current cart
      const cart = await db.query.carts.findFirst({
        where: eq(carts.sessionId, DEMO_SESSION_ID),
        with: {
          items: {
            with: {
              product: true,
            },
          },
        },
      });

      // If cart is empty, return empty recommendations
      if (!cart || cart.items.length === 0) {
        return {
          recommendations: [],
          cartAnalysis: "Add items to your cart to see personalized recommendations.",
        };
      }

      // Get all products for recommendations with variants (exclude custom designs)
      const allProducts = await db.query.products.findMany({
        where: ne(products.category, "custom"),
        with: {
          variants: true,
        },
      });

      // Extract cart products
      const cartProducts = cart.items.map((item) => item.product);

      // Get AI recommendations
      const recommendations = await getCartRecommendations(
        cartProducts,
        allProducts,
        input
      );

      return recommendations;
    }),
});
