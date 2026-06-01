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

/**
 * Look up current inventory_quantity for a set of variant SKUs (Medusa is now
 * the inventory source). Returns a map SKU -> stock; SKUs not found are absent.
 * Used by the Kustom validation callback to re-check stock at payment time.
 */
export async function getStockBySku(
  skus: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!skus.length) return map
  // The catalog is small; fetch all variants with sku + inventory and filter.
  const { products } = await medusa.store.product.list({
    fields: "variants.sku,variants.inventory_quantity,variants.manage_inventory",
    limit: 200,
  })
  const wanted = new Set(skus)
  for (const p of products) {
    for (const v of (p.variants ?? []) as {
      sku?: string | null
      inventory_quantity?: number | null
      manage_inventory?: boolean | null
    }[]) {
      if (v.sku && wanted.has(v.sku)) {
        // Variants that don't manage inventory (e.g. custom designs) are always
        // available — represent that as a large number.
        map.set(
          v.sku,
          v.manage_inventory === false
            ? Number.MAX_SAFE_INTEGER
            : v.inventory_quantity ?? 0
        )
      }
    }
  }
  return map
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
