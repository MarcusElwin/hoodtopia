/**
 * Resolves the MedusaJS cart id for a storefront session.
 *
 * The demo uses a fixed session id (DEMO_SESSION_ID). We persist the
 * session→Medusa-cart-id mapping in the storefront DB (medusa_carts table) so
 * the same cart is reused across requests — the cookie-less equivalent of the
 * old carts table, but the cart contents live in Medusa.
 */
import { eq } from "drizzle-orm"
import { db, medusaCarts } from "@/db"
import { createCart, retrieveCart } from "@/lib/commerce/medusa-cart"

/** For demo parity with the old cart router. */
export const DEMO_SESSION_ID = "demo-session"

/**
 * Return the Medusa cart id for this session, creating a fresh cart (and the
 * mapping row) if none exists yet or the stored one was deleted server-side.
 */
export async function getOrCreateCartId(
  sessionId: string = DEMO_SESSION_ID,
  currencyCode?: string
): Promise<string> {
  const existing = await db.query.medusaCarts.findFirst({
    where: eq(medusaCarts.sessionId, sessionId),
  })

  if (existing) {
    // Reuse the stored cart only if it still exists AND hasn't been completed
    // into an order. A completed cart is frozen (can't add/update/remove items),
    // so after checkout we must start a fresh one.
    const cart = await retrieveCart(existing.medusaCartId)
    if (cart && !cart.completedAt) return existing.medusaCartId
  }

  const cartId = await createCart(currencyCode)
  await db
    .insert(medusaCarts)
    .values({ sessionId, medusaCartId: cartId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: medusaCarts.sessionId,
      set: { medusaCartId: cartId, updatedAt: new Date() },
    })
  return cartId
}

/** Drop the stored cart id so the next request starts a brand-new cart. */
export async function resetCart(sessionId: string = DEMO_SESSION_ID): Promise<void> {
  await db.delete(medusaCarts).where(eq(medusaCarts.sessionId, sessionId))
}
