import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createCollectionsWorkflow,
  createPriceListsWorkflow,
  createProductTagsWorkflow,
  createProductTypesWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { hoodies, accessories } from "../data/catalog"

/**
 * Applies the metadata/shipping/price-list additions to an ALREADY-SEEDED DB
 * (so we don't wipe carts/promotions with a full reseed). Idempotent.
 *   1. Native `material` column on every product.
 *   2. KSA-market carrier shipping options (mirrors src/lib/kustom/markets.ts).
 *   3. A "Summer Sale" price list (20% off hoodies, USD/EUR).
 */
export default async function seedExtras({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule = container.resolve(Modules.PRODUCT)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const pricingModule = container.resolve(Modules.PRICING)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  // ── 1. Native material ────────────────────────────────────────────────────
  const materialBySlug = new Map<string, string>()
  for (const p of [...hoodies, ...accessories]) materialBySlug.set(p.slug, p.material)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "material"],
  })
  let mat = 0
  for (const p of products) {
    const want = materialBySlug.get(p.handle as string)
    if (want && p.material !== want) {
      await productModule.updateProducts(p.id, { material: want })
      mat++
    }
  }
  logger.info(`Set native material on ${mat} products.`)

  // ── 2. KSA carrier shipping options ───────────────────────────────────────
  const SHIPPING_OPTIONS = [
    { name: "Pickup Point", code: "pickup", desc: "Collect from a parcel locker.",
      prices: { usd: 4, sek: 29, gbp: 3, eur: 3, jpy: 400 } },
    { name: "PostNord (SE)", code: "postnord", desc: "PostNord Standard — Sweden.",
      prices: { sek: 49 } },
    { name: "Royal Mail (GB)", code: "royal-mail", desc: "Royal Mail Tracked 48.",
      prices: { gbp: 5 } },
    { name: "USPS (US)", code: "usps", desc: "USPS Ground Advantage.",
      prices: { usd: 6 } },
    { name: "DHL (DE)", code: "dhl", desc: "DHL Paket — Germany.",
      prices: { eur: 5 } },
    { name: "Japan Post (JP)", code: "japan-post", desc: "Japan Post Yū-Pack.",
      prices: { jpy: 600 } },
  ]

  const [shippingProfile] = await fulfillmentModule.listShippingProfiles({
    type: "default",
  })
  const [fulfillmentSet] = await fulfillmentModule.listFulfillmentSets(
    { type: "shipping" },
    { relations: ["service_zones"] }
  )
  const existingOptions = await fulfillmentModule.listShippingOptions({})
  const existingNames = new Set(existingOptions.map((o) => o.name))
  const newOptions = SHIPPING_OPTIONS.filter((o) => !existingNames.has(o.name))

  if (newOptions.length && shippingProfile && fulfillmentSet?.service_zones?.[0]) {
    await createShippingOptionsWorkflow(container).run({
      input: newOptions.map((o) => ({
        name: o.name,
        price_type: "flat" as const,
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: o.name, description: o.desc, code: o.code },
        prices: Object.entries(o.prices).map(([currency_code, amount]) => ({
          currency_code,
          amount,
        })),
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
          { attribute: "is_return", value: "false", operator: "eq" as const },
        ],
      })),
    })
    logger.info(`Created ${newOptions.length} carrier shipping options.`)
  } else {
    logger.info("Carrier shipping options already exist, skipping.")
  }

  // ── 3. Summer Sale price list ─────────────────────────────────────────────
  const allLists = await pricingModule.listPriceLists({})
  const existingLists = allLists.filter((l) => l.title === "Summer Sale")
  if (!existingLists.length) {
    const hoodieHandles = hoodies.map((h) => h.slug)
    type V = {
      id: string
      product?: { handle?: string } | null
      prices?: { amount: number; currency_code: string }[] | null
    }
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "product.handle", "prices.amount", "prices.currency_code"],
    })
    const salePrices = (variants as V[])
      .filter((v) => hoodieHandles.includes(v.product?.handle ?? ""))
      .flatMap((v) =>
        (v.prices ?? [])
          .filter((p) => ["usd", "eur"].includes(p.currency_code))
          .map((p) => ({
            variant_id: v.id,
            currency_code: p.currency_code,
            amount: Math.round(p.amount * 0.8 * 100) / 100,
          }))
      )
    if (salePrices.length) {
      await createPriceListsWorkflow(container).run({
        input: {
          price_lists_data: [
            {
              title: "Summer Sale",
              description: "20% off all hoodies (USD/EUR).",
              status: "active" as const,
              prices: salePrices,
            },
          ],
        },
      })
      logger.info(`Created Summer Sale price list (${salePrices.length} prices).`)
    }
  } else {
    logger.info("Summer Sale price list already exists, skipping.")
  }

  // ── 4. Collections ────────────────────────────────────────────────────────
  const hoodieSlugs = new Set(hoodies.map((h) => h.slug))
  const featuredSlugs = new Set(
    [...hoodies, ...accessories].filter((p) => p.featured).map((p) => p.slug)
  )

  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "collection_id"],
  })

  const existingCollections = await productModule.listProductCollections({
    title: ["Hoodies", "Accessories", "Editor's Choice"],
  })
  const haveTitles = new Set(existingCollections.map((c) => c.title))

  // A product can only belong to ONE collection in Medusa, so we use mutually
  // exclusive buckets: Editor's Choice (featured) wins, else Hoodies/Accessories.
  const wantedCollections = [
    { title: "Editor's Choice", handle: "editors-choice" },
    { title: "Hoodies", handle: "hoodies" },
    { title: "Accessories", handle: "accessories" },
  ].filter((c) => !haveTitles.has(c.title))

  if (wantedCollections.length) {
    const { result: created } = await createCollectionsWorkflow(container).run({
      input: { collections: wantedCollections },
    })
    const idByTitle = new Map(created.map((c) => [c.title, c.id]))

    let assigned = 0
    for (const p of allProducts) {
      const handle = p.handle as string
      let title: string | null = null
      if (featuredSlugs.has(handle)) title = "Editor's Choice"
      else if (hoodieSlugs.has(handle)) title = "Hoodies"
      else title = "Accessories"

      const collectionId = idByTitle.get(title)
      if (collectionId && p.collection_id !== collectionId) {
        await productModule.updateProducts(p.id, { collection_id: collectionId })
        assigned++
      }
    }
    logger.info(
      `Created ${created.length} collections, assigned ${assigned} products.`
    )
  } else {
    logger.info("Collections already exist, skipping.")
  }

  // ── 5. Agentic sales channel (for AI chat / agentic commerce) ─────────────
  const existingChannels = await salesChannelModule.listSalesChannels({
    name: ["AI Agents"],
  })
  if (!existingChannels.length) {
    await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: "AI Agents",
            description:
              "Agentic commerce channel — AI chat assistant + autonomous shopping agents.",
          },
        ],
      },
    })
    logger.info("Created 'AI Agents' sales channel.")
  } else {
    logger.info("'AI Agents' sales channel already exists, skipping.")
  }

  // ── 6. Product types ──────────────────────────────────────────────────────
  const existingTypes = (await productModule.listProductTypes({})).filter((t) =>
    ["Hoodie", "Accessory"].includes(t.value)
  )
  const haveTypeValues = new Set(existingTypes.map((t) => t.value))
  const wantedTypes = ["Hoodie", "Accessory"].filter(
    (v) => !haveTypeValues.has(v)
  )
  const typeIdByValue = new Map(existingTypes.map((t) => [t.value, t.id]))
  if (wantedTypes.length) {
    const { result: createdTypes } = await createProductTypesWorkflow(
      container
    ).run({
      input: { product_types: wantedTypes.map((value) => ({ value })) },
    })
    for (const t of createdTypes) typeIdByValue.set(t.value, t.id)
    logger.info(`Created product types: ${wantedTypes.join(", ")}`)
  }

  // ── 7. Tags (AI-shopping facets) ──────────────────────────────────────────
  const TAGS = ["cozy", "athletic", "streetwear", "gift", "eco-friendly", "bestseller"]
  const existingTags = (await productModule.listProductTags({})).filter((t) =>
    TAGS.includes(t.value)
  )
  const haveTagValues = new Set(existingTags.map((t) => t.value))
  const wantedTags = TAGS.filter((v) => !haveTagValues.has(v))
  const tagIdByValue = new Map(existingTags.map((t) => [t.value, t.id]))
  if (wantedTags.length) {
    const { result: createdTags } = await createProductTagsWorkflow(container).run({
      input: { product_tags: wantedTags.map((value) => ({ value })) },
    })
    for (const t of createdTags) tagIdByValue.set(t.value, t.id)
    logger.info(`Created tags: ${wantedTags.join(", ")}`)
  }

  // Assign types + a couple of relevant tags per product.
  const featuredSlugSet = new Set(
    [...hoodies, ...accessories].filter((p) => p.featured).map((p) => p.slug)
  )
  const tagForCategory: Record<string, string[]> = {
    casual: ["cozy", "bestseller"],
    performance: ["athletic"],
    athletic: ["athletic"],
    streetwear: ["streetwear"],
    premium: ["bestseller"],
    outdoor: ["cozy"],
  }
  const catBySlug = new Map(
    [...hoodies, ...accessories].map((p) => [p.slug, p.category])
  )

  let typed = 0
  for (const p of allProducts) {
    const handle = p.handle as string
    const isHoodie = hoodieSlugs.has(handle)
    const typeId = typeIdByValue.get(isHoodie ? "Hoodie" : "Accessory")
    const cat = catBySlug.get(handle) ?? ""
    const tagValues = new Set<string>(tagForCategory[cat] ?? [])
    if (!isHoodie) tagValues.add("gift")
    if (featuredSlugSet.has(handle)) tagValues.add("bestseller")
    const tag_ids = [...tagValues]
      .map((v) => tagIdByValue.get(v))
      .filter((id): id is string => Boolean(id))

    await productModule.updateProducts(p.id, {
      type_id: typeId,
      tag_ids,
    })
    typed++
  }
  logger.info(`Assigned type + tags to ${typed} products.`)

  logger.info("✅ seed-extras complete.")
}
