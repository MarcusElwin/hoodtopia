import { z } from "zod";
import { eq, like, or, and } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { db, products, productVariants } from "@/db";

export const productsRouter = router({
  // Get all products with optional filtering
  list: publicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          featured: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const conditions = [];

      if (input?.category) {
        conditions.push(eq(products.category, input.category));
      }
      if (input?.featured !== undefined) {
        conditions.push(eq(products.featured, input.featured));
      }

      const result = await db.query.products.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          variants: true,
        },
        orderBy: (products, { desc }) => [desc(products.featured), desc(products.createdAt)],
      });

      return result;
    }),

  // Get single product by ID
  byId: publicProcedure.input(z.string()).query(async ({ input }) => {
    const result = await db.query.products.findFirst({
      where: eq(products.id, input),
      with: {
        variants: true,
      },
    });

    if (!result) {
      throw new Error("Product not found");
    }

    return result;
  }),

  // Get single product by slug
  bySlug: publicProcedure.input(z.string()).query(async ({ input }) => {
    const result = await db.query.products.findFirst({
      where: eq(products.slug, input),
      with: {
        variants: true,
      },
    });

    if (!result) {
      throw new Error("Product not found");
    }

    return result;
  }),

  // Search products by name or description
  search: publicProcedure.input(z.string()).query(async ({ input }) => {
    const searchTerm = `%${input}%`;

    const result = await db.query.products.findMany({
      where: or(
        like(products.name, searchTerm),
        like(products.description, searchTerm),
        like(products.category, searchTerm)
      ),
      with: {
        variants: true,
      },
    });

    return result;
  }),

  // Get featured products for homepage (hoodies only)
  featured: publicProcedure.query(async () => {
    const accessoryCategories = ["stickers", "pins", "patches"];
    const result = await db.query.products.findMany({
      where: and(
        eq(products.featured, true),
        // Exclude accessories
        ...accessoryCategories.map((cat) =>
          or(eq(products.category, cat)) ? undefined : undefined
        )
      ),
      with: {
        variants: true,
      },
      limit: 4,
    });

    // Filter out accessories in JS since SQL NOT IN is tricky with Drizzle
    return result.filter((p) => !accessoryCategories.includes(p.category));
  }),

  // Get featured accessories for homepage
  featuredAccessories: publicProcedure.query(async () => {
    const accessoryCategories = ["stickers", "pins", "patches"];
    const result = await db.query.products.findMany({
      where: eq(products.featured, true),
      with: {
        variants: true,
      },
    });

    // Filter to only accessories
    return result.filter((p) => accessoryCategories.includes(p.category));
  }),

  // Get all categories
  categories: publicProcedure.query(async () => {
    const result = await db
      .selectDistinct({ category: products.category })
      .from(products);

    return result.map((r) => r.category);
  }),

  // Get available colors for a product
  getColors: publicProcedure.input(z.string()).query(async ({ input }) => {
    const result = await db
      .selectDistinct({
        color: productVariants.color,
        colorHex: productVariants.colorHex,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, input));

    return result;
  }),

  // Get available sizes for a product
  getSizes: publicProcedure.input(z.string()).query(async ({ input }) => {
    const result = await db
      .selectDistinct({ size: productVariants.size })
      .from(productVariants)
      .where(eq(productVariants.productId, input));

    return result.map((r) => r.size);
  }),

  // Get specific variant
  getVariant: publicProcedure
    .input(
      z.object({
        productId: z.string(),
        color: z.string(),
        size: z.string(),
      })
    )
    .query(async ({ input }) => {
      const result = await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.productId, input.productId),
          eq(productVariants.color, input.color),
          eq(productVariants.size, input.size)
        ),
      });

      return result;
    }),
});
