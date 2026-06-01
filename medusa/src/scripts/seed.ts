/**
 * Hoodtopia catalog seed.
 *
 * Adapted from the default Medusa starter seed, with Hoodtopia data from
 * src/data/catalog.ts. It:
 *   1. Bootstraps store infra: sales channel, store currencies, 5 regions
 *      (one per Hoodtopia market: US/SE/GB/DE/JP), tax regions, a stock
 *      location, fulfillment set + service zone, two shipping options, and a
 *      publishable API key linked to the sales channel.
 *   2. Creates products: 6 hoodies (Color × Size) + 13 accessories (One Size),
 *      with multi-currency price sets, reused image paths, and categories.
 *   3. Sets per-variant inventory using the ported deterministic stock buckets
 *      (so the demo keeps its "only X left" scarcity story).
 *
 * Concepts: Product Module (options/variants), Pricing Module (price sets),
 * Inventory Module (levels), Sales Channels, Regions, and Workflows — every
 * write goes through a core workflow rather than a raw module call.
 */
import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
} from "@medusajs/medusa/core-flows"

import {
  ACCESSORY_COLOR,
  accessories,
  accessoryImage,
  accessorySku,
  accessoryStock,
  colors,
  hoodies,
  hoodieImage,
  hoodieSku,
  hoodieStock,
  pricesFromUsdCents,
  sizes,
} from "../data/catalog"

// Hoodtopia markets → Medusa regions. Currency switcher in the storefront
// picks a region_id (Phase 3) to get the right price set at cart time.
const REGIONS = [
  { name: "United States", currency_code: "usd", countries: ["us"], is_default: true },
  { name: "Sweden", currency_code: "sek", countries: ["se"] },
  { name: "United Kingdom", currency_code: "gbp", countries: ["gb"] },
  { name: "Germany", currency_code: "eur", countries: ["de"] },
  { name: "Japan", currency_code: "jpy", countries: ["jp"] },
]
const ALL_COUNTRIES = REGIONS.flatMap((r) => r.countries)

// Small workflow to set the store's supported currencies (starter pattern).
const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[]
    store_id: string
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((c) => ({
          currency_code: c.currency_code,
          is_default: c.is_default ?? false,
        })),
      },
    }))
    const stores = updateStoresStep(normalizedInput)
    return new WorkflowResponse(stores)
  }
)

export default async function seedHoodtopia({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const storeModuleService = container.resolve(Modules.STORE)

  // ── Store + sales channel ────────────────────────────────────────────────
  logger.info("Seeding store data...")
  const [store] = await storeModuleService.listStores()
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel.length) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    })
    defaultSalesChannel = result
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        { currency_code: "usd", is_default: true },
        { currency_code: "sek" },
        { currency_code: "gbp" },
        { currency_code: "eur" },
        { currency_code: "jpy" },
      ],
    },
  })

  // ── Regions (one per market) ─────────────────────────────────────────────
  logger.info("Seeding regions...")
  await createRegionsWorkflow(container).run({
    input: {
      regions: REGIONS.map((r) => ({
        name: r.name,
        currency_code: r.currency_code,
        countries: r.countries,
        payment_providers: ["pp_system_default"],
      })),
    },
  })

  logger.info("Seeding tax regions...")
  await createTaxRegionsWorkflow(container).run({
    input: ALL_COUNTRIES.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  })

  // ── Stock location + fulfillment ─────────────────────────────────────────
  logger.info("Seeding stock location + fulfillment...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Hoodtopia Warehouse",
          address: { city: "Stockholm", country_code: "SE", address_1: "" },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    shippingProfile = result[0]
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Hoodtopia delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Hoodtopia markets",
        geo_zones: ALL_COUNTRIES.map((country_code) => ({
          country_code,
          type: "country" as const,
        })),
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  await createShippingOptionsWorkflow(container).run({
    input: ["Standard", "Express"].map((label) => ({
      name: `${label} Shipping`,
      price_type: "flat" as const,
      provider_id: "manual_manual",
      service_zone_id: fulfillmentSet.service_zones[0].id,
      shipping_profile_id: shippingProfile!.id,
      type: {
        label,
        description: label === "Standard" ? "Ship in 3-5 days." : "Ship in 1-2 days.",
        code: label.toLowerCase(),
      },
      prices: [
        { currency_code: "usd", amount: label === "Standard" ? 6 : 13 },
        { currency_code: "sek", amount: label === "Standard" ? 49 : 99 },
        { currency_code: "gbp", amount: label === "Standard" ? 5 : 10 },
        { currency_code: "eur", amount: label === "Standard" ? 5 : 10 },
        { currency_code: "jpy", amount: label === "Standard" ? 600 : 1500 },
      ],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
        { attribute: "is_return", value: "false", operator: "eq" as const },
      ],
    })),
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [defaultSalesChannel[0].id] },
  })

  // ── Publishable API key (scopes the Store API to the sales channel) ───────
  logger.info("Seeding publishable API key...")
  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: { type: "publishable" },
  })
  // Only need id + token here; both result shapes (query.graph vs workflow
  // result) expose these, so type it minimally to avoid a DTO/entity mismatch.
  let publishableApiKey: { id: string; token?: string } | undefined =
    existingKeys?.[0]
  if (!publishableApiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: "Hoodtopia Storefront", type: "publishable", created_by: "" }],
      },
    })
    publishableApiKey = result[0]
  }
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableApiKey.id, add: [defaultSalesChannel[0].id] },
  })
  logger.info(`Publishable API key: ${publishableApiKey.token ?? publishableApiKey.id}`)

  // ── Categories (from the distinct catalog categories) ────────────────────
  logger.info("Seeding categories + products...")
  const categoryNames = Array.from(
    new Set([...hoodies, ...accessories].map((p) => p.category))
  )
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: categoryNames.map((name) => ({ name, is_active: true })),
    },
  })
  const categoryId = (name: string) =>
    categoryResult.find((c) => c.name === name)!.id

  // ── Hoodie products (Color × Size) ───────────────────────────────────────
  const hoodieProducts = hoodies.map((h) => ({
    title: h.name,
    handle: h.slug,
    description: h.description,
    status: ProductStatus.PUBLISHED,
    category_ids: [categoryId(h.category)],
    shipping_profile_id: shippingProfile!.id,
    metadata: {
      material: h.material,
      features: h.features,
      featured: h.featured,
    },
    // Per-colour hero shots (reused from the storefront /public images).
    images: colors.map((c) => ({ url: hoodieImage(h.slug, c.name) })),
    options: [
      { title: "Color", values: colors.map((c) => c.name) },
      { title: "Size", values: sizes },
    ],
    variants: colors.flatMap((c) =>
      sizes.map((size) => ({
        title: `${c.name} / ${size}`,
        sku: hoodieSku(h.slug, c.name, size),
        options: { Color: c.name, Size: size },
        // colorHex carried in metadata so the storefront colour swatches work.
        metadata: { colorHex: c.hex },
        prices: pricesFromUsdCents(h.basePrice),
      }))
    ),
    sales_channels: [{ id: defaultSalesChannel[0].id }],
  }))

  // ── Accessory products (single One Size variant) ─────────────────────────
  const accessoryProducts = accessories.map((a) => ({
    title: a.name,
    handle: a.slug,
    description: a.description,
    status: ProductStatus.PUBLISHED,
    category_ids: [categoryId(a.category)],
    shipping_profile_id: shippingProfile!.id,
    metadata: {
      material: a.material,
      features: a.features,
      featured: a.featured,
    },
    images: [{ url: accessoryImage(a.slug) }],
    options: [{ title: "Color", values: [ACCESSORY_COLOR.name] }],
    variants: [
      {
        title: ACCESSORY_COLOR.name,
        sku: accessorySku(a.slug),
        options: { Color: ACCESSORY_COLOR.name },
        metadata: { colorHex: ACCESSORY_COLOR.hex },
        prices: pricesFromUsdCents(a.basePrice),
      },
    ],
    sales_channels: [{ id: defaultSalesChannel[0].id }],
  }))

  await createProductsWorkflow(container).run({
    input: { products: [...hoodieProducts, ...accessoryProducts] },
  })
  logger.info(
    `Seeded ${hoodieProducts.length} hoodies + ${accessoryProducts.length} accessories.`
  )

  // ── Inventory levels (per-variant stock from the ported buckets) ─────────
  logger.info("Seeding inventory levels...")
  // Pull every inventory item with its variant's SKU + product handle so we can
  // apply the right deterministic stock number per SKU.
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
  })

  const skuToSlug = new Map<string, { slug: string; isHoodie: boolean }>()
  for (const h of hoodies) {
    for (const c of colors)
      for (const s of sizes)
        skuToSlug.set(hoodieSku(h.slug, c.name, s), { slug: h.slug, isHoodie: true })
  }
  for (const a of accessories) {
    skuToSlug.set(accessorySku(a.slug), { slug: a.slug, isHoodie: false })
  }

  const inventoryLevels: CreateInventoryLevelInput[] = inventoryItems.map((item) => {
    const sku = (item.sku ?? "") as string
    const info = skuToSlug.get(sku)
    let stocked = 100
    if (info) {
      stocked = info.isHoodie
        ? hoodieStock(info.slug, sku)
        : accessoryStock(info.slug, sku)
    }
    return {
      location_id: stockLocation.id,
      inventory_item_id: item.id,
      stocked_quantity: stocked,
    }
  })

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  })
  logger.info(`Set inventory for ${inventoryLevels.length} variants.`)
  logger.info("✅ Hoodtopia seed complete.")
}
