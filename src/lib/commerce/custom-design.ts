/**
 * Creates a one-off Medusa product for an AI-generated custom hoodie design,
 * then returns its variant id so the storefront can add it to the Medusa cart.
 *
 * Custom designs are real Medusa products (category "custom", one variant,
 * stock 1) created on demand via the ADMIN API (product creation isn't a Store
 * API operation). The Gemini design record itself stays in the storefront DB
 * (customDesigns) — it's design metadata, not commerce data.
 */
import { medusa, medusaAdmin } from "@/lib/medusa"

/**
 * Demo FX vs 1 USD for custom designs — kept identical to the catalog seed's FX
 * (medusa/src/data/catalog.ts) so a custom design's price is consistent with the
 * rest of the store. Single source: used both to build the Medusa product's
 * price set AND to display the price on the designer page, so display == cart.
 * JPY/SEK have no minor unit (whole numbers).
 */
export const CUSTOM_DESIGN_FX: Record<string, number> = {
  usd: 1,
  eur: 0.92,
  gbp: 0.79,
  sek: 10.8,
  jpy: 150,
}

/** Region price (major units) for a custom design in the given currency. */
export function customDesignPriceMajor(
  priceUsdMajor: number,
  currencyCode: string
): number {
  const cc = currencyCode.toLowerCase()
  const fx = CUSTOM_DESIGN_FX[cc] ?? 1
  const raw = priceUsdMajor * fx
  return cc === "jpy" || cc === "sek" ? Math.round(raw) : Math.round(raw * 100) / 100
}

export interface CustomDesignInput {
  designId: string
  title: string
  description: string
  imageUrl: string
  color: string
  size: string
  /** Price in major units (e.g. 100 for $100). */
  priceMajor: number
}

let cachedSalesChannelId: string | null = null
let cachedShippingProfileId: string | null = null
let cachedCustomCategoryId: string | null = null

/** Resolve (and cache) the infra ids a product needs. */
async function resolveInfra() {
  if (!cachedSalesChannelId) {
    const { sales_channels } = await medusaAdmin.admin.salesChannel.list({
      name: "Default Sales Channel",
    })
    cachedSalesChannelId = sales_channels?.[0]?.id ?? null
  }
  if (!cachedShippingProfileId) {
    const { shipping_profiles } =
      await medusaAdmin.admin.shippingProfile.list({ type: "default" })
    cachedShippingProfileId = shipping_profiles?.[0]?.id ?? null
  }
  if (!cachedCustomCategoryId) {
    const { product_categories } =
      await medusaAdmin.admin.productCategory.list({ q: "custom" })
    const custom = product_categories?.find(
      (c: { id: string; name?: string | null }) =>
        c.name?.toLowerCase() === "custom"
    )
    // Create the "custom" category once if it doesn't exist.
    if (custom) {
      cachedCustomCategoryId = custom.id
    } else {
      const { product_category } =
        await medusaAdmin.admin.productCategory.create({
          name: "custom",
          is_active: true,
          is_internal: true, // hide from storefront listings
        })
      cachedCustomCategoryId = product_category.id
    }
  }
  return {
    salesChannelId: cachedSalesChannelId,
    shippingProfileId: cachedShippingProfileId,
    customCategoryId: cachedCustomCategoryId,
  }
}

export interface CreatedCustomProduct {
  productId: string
  variantId: string
}

/** Create the Medusa product + variant for a custom design. */
export async function createCustomDesignProduct(
  input: CustomDesignInput
): Promise<CreatedCustomProduct> {
  const { salesChannelId, shippingProfileId, customCategoryId } =
    await resolveInfra()

  const sku = `CUSTOM-${input.designId}-${input.size}`
  const { product } = await medusaAdmin.admin.product.create({
    title: input.title,
    // One product per design+size so re-adding a different size doesn't collide
    // on the handle or return the wrong variant.
    handle: `custom-design-${input.designId}-${input.size.toLowerCase()}`,
    description: input.description,
    status: "published",
    thumbnail: input.imageUrl,
    images: [{ url: input.imageUrl }],
    ...(customCategoryId ? { categories: [{ id: customCategoryId }] } : {}),
    ...(shippingProfileId ? { shipping_profile_id: shippingProfileId } : {}),
    metadata: { custom_design_id: input.designId, custom: true },
    options: [
      { title: "Color", values: [input.color] },
      { title: "Size", values: [input.size] },
    ],
    variants: [
      {
        title: `${input.color} / ${input.size}`,
        sku,
        manage_inventory: false, // one-of-a-kind; skip inventory tracking
        options: { Color: input.color, Size: input.size },
        prices: Object.keys(CUSTOM_DESIGN_FX).map((cc) => ({
          currency_code: cc,
          amount: customDesignPriceMajor(input.priceMajor, cc),
        })),
      },
    ],
    ...(salesChannelId ? { sales_channels: [{ id: salesChannelId }] } : {}),
  })

  const variantId = product.variants?.[0]?.id
  if (!variantId) {
    throw new Error("Custom design product created without a variant")
  }
  return { productId: product.id, variantId }
}

/**
 * Look up an existing custom-design product's variant for a specific size.
 * The variant SKU is `CUSTOM-<designId>-<size>`, so we match on that — returning
 * the first variant regardless of size could add the wrong size to the cart.
 * Returns null if the design product or that size's variant doesn't exist yet.
 */
export async function findCustomDesignVariant(
  designId: string,
  size: string
): Promise<string | null> {
  // One product per design+size (handle: custom-design-<id>-<size>), so a hit
  // here is already the right size.
  const { products } = await medusa.store.product.list({
    handle: `custom-design-${designId}-${size.toLowerCase()}`,
    fields: "id,variants.id",
  })
  return products?.[0]?.variants?.[0]?.id ?? null
}
