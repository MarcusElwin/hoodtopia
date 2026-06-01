/**
 * Thin server-side wrappers around Medusa's Store product API, returning data
 * already mapped through the product-adapter into the storefront's legacy
 * shape. The tRPC products router (the storefront BFF) calls these so UI/AI
 * components keep consuming the exact same `Product & { variants }` objects.
 */
import { medusa } from "@/lib/medusa"
import {
  adaptProduct,
  adaptProducts,
  type AdaptedProduct,
  type MedusaProduct,
} from "@/lib/commerce/product-adapter"

// Fields we always pull so the adapter has everything it needs (variant
// options, prices, metadata, images, categories).
const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "description",
  "thumbnail",
  "metadata",
  "*categories",
  "*images",
  "*variants",
  "variants.sku",
  "variants.title",
  "variants.metadata",
  "variants.inventory_quantity",
  "variants.options.value",
  "variants.options.option.title",
  "*variants.calculated_price",
].join(",")

// Default pricing context. Medusa needs a region to compute `calculated_price`;
// without one, variants come back without prices. The currency switcher
// (Phase 3 final commit) passes a real region_id; this is the fallback.
let cachedRegionId: string | null = null

/** Resolve a region id for the given currency (defaults to the store default). */
interface RegionLite {
  id: string
  currency_code?: string | null
}

export async function resolveRegionId(currencyCode?: string): Promise<string> {
  const { regions } = (await medusa.store.region.list()) as {
    regions: RegionLite[]
  }
  if (currencyCode) {
    const match = regions.find(
      (r) => r.currency_code?.toLowerCase() === currencyCode.toLowerCase()
    )
    if (match) return match.id
  }
  if (cachedRegionId) return cachedRegionId
  // Prefer USD as the default display currency (matches the old USD-cents base).
  const usd = regions.find((r) => r.currency_code?.toLowerCase() === "usd")
  cachedRegionId = usd?.id ?? regions[0]?.id ?? ""
  return cachedRegionId
}

interface ListOpts {
  regionId?: string
  currencyCode?: string
  categoryId?: string
  q?: string
  limit?: number
}

/** List products (mapped). Excludes the `custom` category like the old router. */
export async function listProducts(opts: ListOpts = {}): Promise<AdaptedProduct[]> {
  const region_id = opts.regionId ?? (await resolveRegionId(opts.currencyCode))
  const { products } = await medusa.store.product.list({
    region_id,
    fields: PRODUCT_FIELDS,
    limit: opts.limit ?? 100,
    ...(opts.categoryId ? { category_id: opts.categoryId } : {}),
    ...(opts.q ? { q: opts.q } : {}),
  })
  return adaptProducts(products as unknown as MedusaProduct[]).filter(
    (p) => p.category !== "custom"
  )
}

/** Fetch one product by Medusa id (mapped), or null. */
export async function getProductById(
  id: string,
  opts: { regionId?: string; currencyCode?: string } = {}
): Promise<AdaptedProduct | null> {
  const region_id = opts.regionId ?? (await resolveRegionId(opts.currencyCode))
  try {
    const { product } = await medusa.store.product.retrieve(id, {
      region_id,
      fields: PRODUCT_FIELDS,
    })
    return adaptProduct(product as unknown as MedusaProduct)
  } catch {
    return null
  }
}

/** Fetch one product by handle/slug (mapped), or null. */
export async function getProductByHandle(
  handle: string,
  opts: { regionId?: string; currencyCode?: string } = {}
): Promise<AdaptedProduct | null> {
  const region_id = opts.regionId ?? (await resolveRegionId(opts.currencyCode))
  const { products } = await medusa.store.product.list({
    handle,
    region_id,
    fields: PRODUCT_FIELDS,
    limit: 1,
  })
  if (!products.length) return null
  return adaptProduct(products[0] as unknown as MedusaProduct)
}

/** Resolve a category name (old schema) to a Medusa category id. */
export async function resolveCategoryId(name: string): Promise<string | null> {
  const { product_categories } = (await medusa.store.category.list({
    fields: "id,name",
    limit: 100,
  })) as { product_categories: { id: string; name?: string | null }[] }
  const match = product_categories.find(
    (c) => c.name?.toLowerCase() === name.toLowerCase()
  )
  return match?.id ?? null
}
