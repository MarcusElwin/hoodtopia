/**
 * Medusa → storefront product adapter.
 *
 * This is the seam that lets the entire existing UI + AI keep working while the
 * data source moves from Drizzle to Medusa. The storefront's components and AI
 * services are typed against the old Drizzle `Product` / `ProductVariant` /
 * `ProductImage` shapes (imported from `@/db/schema`). Rather than touch dozens
 * of components, the tRPC routers (Phase 3+) fetch from Medusa's Store API and
 * run the responses through these functions to produce that exact shape.
 *
 * Field mapping (Medusa Store API → Drizzle shape):
 *   product.title                 → name
 *   product.handle                → slug
 *   variant.calculated_price.*    → basePrice / priceAtAdd (×100, Medusa returns
 *                                   MAJOR units e.g. 59.99; the UI's formatPrice
 *                                   expects integer minor units / cents)
 *   product.thumbnail|images[]    → imageUrl (per-colour hero)
 *   product.categories[0].name    → category
 *   product.metadata.featured     → featured
 *   product.metadata.material     → material
 *   product.metadata.features[]   → features (JSON.stringify — UI does JSON.parse)
 *   variant.options (Color/Size)  → color / size
 *   variant.metadata.colorHex     → colorHex
 *   variant.sku                   → sku
 *   variant.inventory_quantity    → stock
 *
 * We keep Medusa's own ids (prod_…, variant_…) as the `id` fields — the
 * storefront only treats ids as opaque keys, and cart/checkout (Phase 4-5) need
 * the real Medusa ids to call the cart API.
 */
import type { Product, ProductVariant, ProductImage } from "@/db/schema"

// ── Minimal Store API shapes (only the fields we read) ──────────────────────
// We define these locally instead of depending on @medusajs/types, which pulls
// a conflicting vite peer (see src/lib/medusa.ts install note).
export interface MedusaCalculatedPrice {
  calculated_amount?: number | null
  currency_code?: string | null
}

export interface MedusaVariantOption {
  value?: string | null
  option?: { title?: string | null } | null
}

export interface MedusaVariant {
  id: string
  sku?: string | null
  title?: string | null
  thumbnail?: string | null
  inventory_quantity?: number | null
  metadata?: Record<string, unknown> | null
  options?: MedusaVariantOption[] | null
  calculated_price?: MedusaCalculatedPrice | null
}

export interface MedusaImage {
  id?: string
  url: string
  rank?: number | null
  metadata?: Record<string, unknown> | null
}

export interface MedusaProduct {
  id: string
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  images?: MedusaImage[] | null
  metadata?: Record<string, unknown> | null
  categories?: { name: string }[] | null
  variants?: MedusaVariant[] | null
}

// Output type: exactly what the UI/AI consume from the products router today.
export type AdaptedProduct = Product & {
  variants: ProductVariant[]
  images?: ProductImage[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Read a Color/Size option value off a Medusa variant. */
function optionValue(variant: MedusaVariant, title: "Color" | "Size"): string {
  const match = variant.options?.find(
    (o) => o.option?.title?.toLowerCase() === title.toLowerCase()
  )
  return match?.value ?? ""
}

/** Medusa returns prices in major units (59.99); the UI wants cents (5999). */
function toMinorUnits(amount?: number | null): number {
  if (amount == null) return 0
  return Math.round(amount * 100)
}

function colorSlug(color: string): string {
  return color.toLowerCase().replace(/ /g, "-")
}

// The seed stores ABSOLUTE image URLs (so the Medusa admin can preview them).
// On the storefront these point back at our own origin, so normalize them to
// RELATIVE paths — that way Next serves them same-origin without needing the
// host in next.config images.remotePatterns. Leaves truly external URLs alone.
const STOREFRONT_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3005"
).replace(/\/$/, "")

function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null
  if (url.startsWith(`${STOREFRONT_ORIGIN}/`)) {
    return url.slice(STOREFRONT_ORIGIN.length)
  }
  // Also fold the common localhost storefront origin in case SITE_URL differs.
  const localMatch = url.match(/^https?:\/\/localhost:\d+(\/images\/.*)$/)
  if (localMatch) return localMatch[1]
  return url
}

/**
 * Pick the per-colour hero image for a variant. Medusa images are product-level
 * and named `<handle>-<colour>.jpg` by the seed, so we match by filename. Falls
 * back to the variant thumbnail, then the product thumbnail.
 */
function variantImage(
  product: MedusaProduct,
  variant: MedusaVariant,
  color: string
): string | null {
  const wanted = `${product.handle}-${colorSlug(color)}`
  const byColor = product.images?.find((img) => img.url.includes(wanted))
  return normalizeImageUrl(
    byColor?.url ?? variant.thumbnail ?? product.thumbnail ?? null
  )
}

// ── Adapters ────────────────────────────────────────────────────────────────

export function adaptVariant(
  product: MedusaProduct,
  variant: MedusaVariant
): ProductVariant {
  const color = optionValue(variant, "Color")
  const size = optionValue(variant, "Size")
  return {
    id: variant.id,
    productId: product.id,
    color,
    colorHex: (variant.metadata?.colorHex as string) ?? "#000000",
    size: size || "One Size",
    stock: variant.inventory_quantity ?? 0,
    imageUrl: variantImage(product, variant, color),
    sku: variant.sku ?? variant.id,
  }
}

/** Extra-angle images for the PDP carousel (one row per product image). */
export function adaptImages(product: MedusaProduct): ProductImage[] {
  const variants = product.variants ?? []
  return (product.images ?? []).map((img, i) => {
    // Best-effort: tie each image to the variant whose colour appears in its
    // filename, so the PDP's per-colour carousel filter still works.
    const match = variants.find((v) => {
      const color = optionValue(v, "Color")
      return color && img.url.includes(colorSlug(color))
    })
    return {
      id: img.id ?? `${product.id}-img-${i}`,
      productId: product.id,
      variantId: match?.id ?? variants[0]?.id ?? product.id,
      url: normalizeImageUrl(img.url) ?? img.url,
      position: img.rank ?? i,
      alt: (img.metadata?.alt as string) ?? product.title,
      createdAt: new Date(),
    }
  })
}

export function adaptProduct(product: MedusaProduct): AdaptedProduct {
  const variants = (product.variants ?? []).map((v) => adaptVariant(product, v))
  // basePrice = cheapest variant's calculated price (in cents). Variants share a
  // price here, so the first is representative; min() is just defensive.
  const basePrice = Math.min(
    ...(product.variants ?? []).map((v) =>
      toMinorUnits(v.calculated_price?.calculated_amount)
    ).filter((n) => n > 0),
    ...[Number.POSITIVE_INFINITY]
  )
  const features = product.metadata?.features
  return {
    id: product.id,
    name: product.title,
    slug: product.handle,
    description: product.description ?? "",
    basePrice: Number.isFinite(basePrice) ? basePrice : 0,
    imageUrl:
      normalizeImageUrl(product.thumbnail ?? product.images?.[0]?.url) ?? "",
    category: product.categories?.[0]?.name ?? "uncategorized",
    featured: Boolean(product.metadata?.featured),
    material: (product.metadata?.material as string) ?? null,
    features: Array.isArray(features) ? JSON.stringify(features) : null,
    createdAt: new Date(),
    variants,
    images: adaptImages(product),
  }
}

export function adaptProducts(products: MedusaProduct[]): AdaptedProduct[] {
  return products.map(adaptProduct)
}
