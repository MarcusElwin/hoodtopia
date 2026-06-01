import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import {
  listProducts,
  getProductById,
  getProductByHandle,
  resolveCategoryId,
} from "@/lib/commerce/medusa-products";

// Hoodie categories (main products) vs accessories — same split the storefront
// used against Drizzle, kept so featured()/featuredAccessories() behave the same.
const HOODIE_CATEGORIES = [
  "casual",
  "performance",
  "athletic",
  "streetwear",
  "premium",
  "outdoor",
];

/**
 * Products router — now backed by the MedusaJS Store API instead of Drizzle.
 *
 * The procedure names, inputs, and output shapes are unchanged: each returns
 * the legacy `Product & { variants }` shape (produced by the product-adapter),
 * so every UI/AI component keeps working without edits. tRPC stays the
 * storefront's BFF; the Medusa SDK calls live behind these procedures.
 *
 * `currency` is an optional input on the read procedures so the storefront's
 * currency switcher can request region-scoped prices (Phase 3). It defaults to
 * the store's default region (USD) when omitted.
 */
export const productsRouter = router({
  // All products with optional category/featured filtering.
  list: publicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          featured: z.boolean().optional(),
          currency: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const categoryId = input?.category
        ? await resolveCategoryId(input.category)
        : undefined;

      let products = await listProducts({
        currencyCode: input?.currency,
        categoryId: categoryId ?? undefined,
      });

      // `featured` lives in product metadata, not a queryable column, so filter
      // in memory (the catalog is small).
      if (input?.featured !== undefined) {
        products = products.filter((p) => p.featured === input.featured);
      }
      return products;
    }),

  // Single product by Medusa id.
  byId: publicProcedure
    .input(
      z.union([
        z.string(),
        z.object({ id: z.string(), currency: z.string().optional() }),
      ])
    )
    .query(async ({ input }) => {
      const id = typeof input === "string" ? input : input.id;
      const currency = typeof input === "string" ? undefined : input.currency;
      const product = await getProductById(id, { currencyCode: currency });
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      return product;
    }),

  // Single product by slug/handle (+ per-variant carousel images via adapter).
  bySlug: publicProcedure
    .input(
      z.union([
        z.string(),
        z.object({ slug: z.string(), currency: z.string().optional() }),
      ])
    )
    .query(async ({ input }) => {
      const slug = typeof input === "string" ? input : input.slug;
      const currency = typeof input === "string" ? undefined : input.currency;
      const product = await getProductByHandle(slug, { currencyCode: currency });
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      return product;
    }),

  // Full-text search by name/description/category (Medusa `q`).
  search: publicProcedure
    .input(
      z.union([
        z.string(),
        z.object({ term: z.string(), currency: z.string().optional() }),
      ])
    )
    .query(async ({ input }) => {
      const term = typeof input === "string" ? input : input.term;
      const currency = typeof input === "string" ? undefined : input.currency;
      return listProducts({ q: term, currencyCode: currency });
    }),

  // Featured hoodies for the homepage (max 4).
  featured: publicProcedure
    .input(z.object({ currency: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const products = await listProducts({ currencyCode: input?.currency });
      return products
        .filter((p) => p.featured && HOODIE_CATEGORIES.includes(p.category))
        .slice(0, 4);
    }),

  // Featured accessories for the homepage (anything featured that isn't a hoodie).
  featuredAccessories: publicProcedure
    .input(z.object({ currency: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const products = await listProducts({ currencyCode: input?.currency });
      return products.filter(
        (p) => p.featured && !HOODIE_CATEGORIES.includes(p.category)
      );
    }),

  // Distinct category names (excludes custom, handled in listProducts).
  categories: publicProcedure.query(async () => {
    const products = await listProducts();
    return Array.from(new Set(products.map((p) => p.category)));
  }),

  // Available colors for a product (derived from variant options).
  getColors: publicProcedure.input(z.string()).query(async ({ input }) => {
    const product = await getProductById(input);
    if (!product) return [];
    const seen = new Map<string, { color: string; colorHex: string }>();
    for (const v of product.variants) {
      if (!seen.has(v.color)) {
        seen.set(v.color, { color: v.color, colorHex: v.colorHex });
      }
    }
    return Array.from(seen.values());
  }),

  // Available sizes for a product (derived from variant options).
  getSizes: publicProcedure.input(z.string()).query(async ({ input }) => {
    const product = await getProductById(input);
    if (!product) return [];
    return Array.from(new Set(product.variants.map((v) => v.size)));
  }),

  // Specific variant by (productId, color, size).
  getVariant: publicProcedure
    .input(
      z.object({
        productId: z.string(),
        color: z.string(),
        size: z.string(),
      })
    )
    .query(async ({ input }) => {
      const product = await getProductById(input.productId);
      if (!product) return undefined;
      return product.variants.find(
        (v) => v.color === input.color && v.size === input.size
      );
    }),
});
