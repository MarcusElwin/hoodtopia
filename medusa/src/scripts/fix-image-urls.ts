import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Re-point product images to ABSOLUTE storefront URLs so the Medusa admin can
 * preview them (relative /images/* only resolve on the storefront origin).
 * Idempotent: skips images already absolute. Run via `medusa exec`.
 */
export default async function fixImageUrls({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule = container.resolve(Modules.PRODUCT)

  const base = (process.env.STOREFRONT_URL || "https://hoodtopia.co").replace(
    /\/$/,
    ""
  )
  const abs = (u?: string | null) =>
    u && u.startsWith("/images/") ? `${base}${u}` : u

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "images.url"],
  })

  let fixed = 0
  for (const p of products) {
    const newThumb = abs(p.thumbnail)
    const newImages = (p.images ?? [])
      .map((i: { url: string }) => ({ url: abs(i.url)! }))
      .filter((i: { url: string }) => i.url)
    const thumbChanged = newThumb !== p.thumbnail
    const imgsChanged = (p.images ?? []).some((i: { url: string }) =>
      i.url.startsWith("/images/")
    )
    if (thumbChanged || imgsChanged) {
      await productModule.updateProducts(p.id, {
        thumbnail: newThumb ?? undefined,
        images: newImages,
      })
      fixed++
    }
  }
  logger.info(`Re-pointed images to absolute URLs on ${fixed} products.`)
}
