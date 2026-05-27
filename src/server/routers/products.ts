import { z } from "zod";
import { eq, like, or, and, ne } from "drizzle-orm";
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
      const conditions = [
        // Exclude custom designs from general product listings
        ne(products.category, "custom")
      ];

      if (input?.category) {
        conditions.push(eq(products.category, input.category));
      }
      if (input?.featured !== undefined) {
        conditions.push(eq(products.featured, input.featured));
      }

      const result = await db.query.products.findMany({
        where: and(...conditions),
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
        // Per-variant extra angle/lifestyle shots for the PDP carousel +
        // Google Shopping additional_image_link. Each row is tied to a
        // specific variantId so colour switches show that colour's extras.
        images: {
          orderBy: (img, { asc }) => [asc(img.position)],
        },
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
      where: and(
        // Exclude custom designs from search
        ne(products.category, "custom"),
        or(
          like(products.name, searchTerm),
          like(products.description, searchTerm),
          like(products.category, searchTerm)
        )
      ),
      with: {
        variants: true,
      },
    });

    return result;
  }),

  // Get featured products for homepage (hoodies only)
  featured: publicProcedure.query(async () => {
    // Hoodie categories (main products)
    const hoodieCategories = ["casual", "performance", "athletic", "streetwear", "premium", "outdoor"];
    const result = await db.query.products.findMany({
      where: and(
        eq(products.featured, true),
        ne(products.category, "custom")
      ),
      with: {
        variants: true,
      },
      limit: 4,
    });

    // Filter to only hoodies
    return result.filter((p) => hoodieCategories.includes(p.category));
  }),

  // Get featured accessories for homepage
  featuredAccessories: publicProcedure.query(async () => {
    // Hoodie categories to exclude
    const hoodieCategories = ["casual", "performance", "athletic", "streetwear", "premium", "outdoor"];
    const result = await db.query.products.findMany({
      where: and(
        eq(products.featured, true),
        ne(products.category, "custom")
      ),
      with: {
        variants: true,
      },
    });

    // Filter to only accessories (anything not a hoodie or custom)
    return result.filter((p) => !hoodieCategories.includes(p.category));
  }),

  // Get all categories
  categories: publicProcedure.query(async () => {
    const result = await db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(ne(products.category, "custom"));

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
