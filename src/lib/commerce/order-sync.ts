/**
 * Syncs a completed Kustom order into a Medusa order.
 *
 * Shared by the Kustom push webhook (async, ~2 min after payment) and the
 * confirmation page's instant-sync tRPC call. Idempotent: if a Medusa order
 * already exists for this Kustom order id, it's returned without re-completing.
 *
 * The Medusa order faithfully reflects the Kustom checkout: the customer's real
 * shipping/billing address, email, phone, and the shipping carrier they chose
 * (mapped to the matching Medusa shipping option by code).
 */
import { kustom } from "@/lib/kustom/client"
import {
  completeCart,
  findMedusaOrderByKustomId,
  type CompleteAddress,
} from "@/lib/commerce/medusa-cart"
import {
  getOrCreateCartId,
  resetCart,
  DEMO_SESSION_ID,
} from "@/lib/commerce/cart-session"

export interface SyncResult {
  status: "created" | "exists" | "skipped"
  medusaOrderId?: string
  reason?: string
}

// Kustom address → our partial address shape.
function mapAddress(
  a:
    | {
        given_name?: string
        family_name?: string
        street_address?: string
        postal_code?: string
        city?: string
        country?: string
      }
    | undefined,
  fallbackCountry?: string
): CompleteAddress | null {
  if (!a) return null
  return {
    first_name: a.given_name ?? null,
    last_name: a.family_name ?? null,
    address_1: a.street_address ?? null,
    city: a.city ?? null,
    postal_code: a.postal_code ?? null,
    country_code: a.country ?? fallbackCountry ?? null,
  }
}

/**
 * Complete the session's Medusa cart into a Medusa order using the Kustom
 * order's real data. Returns the existing order if already synced.
 */
export async function syncKustomOrder(
  kustomOrderId: string
): Promise<SyncResult> {
  // Idempotency — already synced?
  const existing = await findMedusaOrderByKustomId(kustomOrderId)
  if (existing) {
    return { status: "exists", medusaOrderId: existing }
  }

  // Pull the real order from Kustom (Order Management view).
  const mgmt = await kustom.getManagementOrder(kustomOrderId)

  const shippingAddress = mapAddress(
    mgmt.shipping_address,
    mgmt.purchase_country
  )
  const billingAddress = mapAddress(mgmt.billing_address, mgmt.purchase_country)

  // The carrier/shipping code the customer selected in Kustom.
  const shippingCode =
    (mgmt.selected_shipping_option as { id?: string; name?: string } | undefined)
      ?.id ??
    (mgmt.selected_shipping_option as { name?: string } | undefined)?.name ??
    null

  const cartId = await getOrCreateCartId(DEMO_SESSION_ID)
  const result = await completeCart(cartId, {
    email: mgmt.billing_address?.email ?? null,
    phone: mgmt.billing_address?.phone ?? null,
    address: shippingAddress ?? billingAddress,
    billingAddress: billingAddress ?? shippingAddress,
    shippingCode,
    metadata: {
      kustom_order_id: kustomOrderId,
      kustom_status: mgmt.status,
    },
  })

  if (result.type === "order") {
    // Release the session pointer so the shopper starts a fresh cart.
    await resetCart(DEMO_SESSION_ID)
    return { status: "created", medusaOrderId: result.orderId }
  }
  return { status: "skipped", reason: result.error }
}
