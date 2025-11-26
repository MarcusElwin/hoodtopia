import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { router, publicProcedure } from "../trpc";
import { db, carts, cartItems, products } from "@/db";
import { getCartRecommendations } from "@/services/ai";

// For demo purposes, we use a fixed session ID
// In production, you'd get this from cookies/auth
const DEMO_SESSION_ID = "demo-session";

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
        throw new Error("Failed to create cart");
      }

      // Get product price
      const product = await db.query.products.findFirst({
        where: eq(products.id, input.productId),
      });

      if (!product) {
        throw new Error("Product not found");
      }

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
      if (input.quantity === 0) {
        // Remove item if quantity is 0
        await db.delete(cartItems).where(eq(cartItems.id, input.itemId));
      } else {
        // Update quantity
        await db
          .update(cartItems)
          .set({ quantity: input.quantity })
          .where(eq(cartItems.id, input.itemId));
      }

      return { success: true };
    }),

  // Remove item from cart
  removeItem: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    await db.delete(cartItems).where(eq(cartItems.id, input));
    return { success: true };
  }),

  // Clear entire cart
  clear: publicProcedure.mutation(async () => {
    const cart = await db.query.carts.findFirst({
      where: eq(carts.sessionId, DEMO_SESSION_ID),
    });

    if (cart) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    }

    return { success: true };
  }),

  // Get AI-powered cart recommendations
  getRecommendations: publicProcedure.query(async () => {
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
      allProducts
    );

    return recommendations;
  }),
});
