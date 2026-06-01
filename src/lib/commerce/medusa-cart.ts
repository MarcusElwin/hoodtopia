/**
 * Medusa cart wrappers + adapter.
 *
 * Replaces the old Drizzle cart (carts/cartItems tables + manual adjustStock).
 * Medusa owns the cart and inventory now: line items reserve stock, totals are
 * computed server-side. The tRPC cart router calls these and returns the legacy
 * cart shape so the cart UI is unchanged:
 *
 *   cart = {
 *     id, items: [{ id, quantity, priceAtAdd(cents),
 *                   product: { name, slug, imageUrl },
 *                   variant: { color, size, imageUrl } }],
 *     subtotal(cents), itemCount
 *   }
 *
 * The Medusa cart id is persisted per demo session in the storefront DB (see
 * cart-session.ts) so it survives across requests without cookies — matching
 * the app's existing fixed-DEMO_SESSION model.
 */
import { medusa, medusaAdmin } from "@/lib/medusa"
import { resolveRegionId } from "@/lib/commerce/medusa-products"

// ── Minimal Medusa cart shapes (only fields we read) ────────────────────────
export interface MedusaLineItem {
  id: string
  quantity: number
  unit_price: number
  title?: string | null
  product_id?: string | null
  product_title?: string | null
  product_handle?: string | null
  variant_id?: string | null
  variant_title?: string | null
  variant_sku?: string | null
  thumbnail?: string | null
}

export interface MedusaCart {
  id: string
  region_id?: string | null
  currency_code?: string | null
  item_total?: number | null
  subtotal?: number | null
  items?: MedusaLineItem[] | null
}

// ── Adapted (legacy) cart shape the UI consumes ─────────────────────────────
export interface AdaptedCartItem {
  id: string
  quantity: number
  /** cents */
  priceAtAdd: number
  variantId: string
  productId: string
  product: { name: string; slug: string; imageUrl: string }
  variant: { color: string; size: string; imageUrl: string | null; sku: string }
}

export interface AdaptedCart {
  id: string
  items: AdaptedCartItem[]
  /** cents */
  subtotal: number
  itemCount: number
}

const toCents = (major?: number | null) =>
  major == null ? 0 : Math.round(major * 100)

// Fold same-origin absolute image URLs back to relative paths (the seed stores
// absolute URLs so the Medusa admin can preview them). See product-adapter.
const STOREFRONT_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3005"
).replace(/\/$/, "")
function relImage(url?: string | null): string | null {
  if (!url) return null
  if (url.startsWith(`${STOREFRONT_ORIGIN}/`)) return url.slice(STOREFRONT_ORIGIN.length)
  const m = url.match(/^https?:\/\/localhost:\d+(\/images\/.*)$/)
  return m ? m[1] : url
}

/** Split a Medusa variant_title like "Black / XS" into color + size. */
function splitVariantTitle(title?: string | null): { color: string; size: string } {
  if (!title) return { color: "", size: "One Size" }
  const parts = title.split("/").map((s) => s.trim())
  if (parts.length >= 2) return { color: parts[0], size: parts[1] }
  return { color: parts[0] ?? "", size: "One Size" }
}

export function adaptCartItem(li: MedusaLineItem): AdaptedCartItem {
  const { color, size } = splitVariantTitle(li.variant_title)
  return {
    id: li.id,
    quantity: li.quantity,
    priceAtAdd: toCents(li.unit_price),
    variantId: li.variant_id ?? "",
    productId: li.product_id ?? "",
    product: {
      name: li.product_title ?? li.title ?? "",
      slug: li.product_handle ?? "",
      imageUrl: relImage(li.thumbnail) ?? "",
    },
    variant: {
      color,
      size,
      imageUrl: relImage(li.thumbnail),
      sku: li.variant_sku ?? "",
    },
  }
}

export function adaptCart(cart: MedusaCart): AdaptedCart {
  const items = (cart.items ?? []).map(adaptCartItem)
  return {
    id: cart.id,
    items,
    subtotal: toCents(cart.item_total ?? cart.subtotal),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  }
}

// Fields pulled on every cart fetch so the adapter has product/variant context.
const CART_FIELDS = [
  "id",
  "region_id",
  "currency_code",
  "item_total",
  "subtotal",
  "*items",
  "items.product_title",
  "items.product_handle",
  "items.product_id",
  "items.variant_title",
  "items.variant_sku",
  "items.variant_id",
  "items.thumbnail",
  "items.unit_price",
  "items.quantity",
].join(",")

/** Create a fresh Medusa cart for the given currency (region). Returns its id. */
export async function createCart(currencyCode?: string): Promise<string> {
  const region_id = await resolveRegionId(currencyCode)
  const { cart } = await medusa.store.cart.create({ region_id })
  return cart.id
}

/** Retrieve a cart (mapped). Returns null if it no longer exists. */
export async function retrieveCart(cartId: string): Promise<AdaptedCart | null> {
  try {
    const { cart } = await medusa.store.cart.retrieve(cartId, {
      fields: CART_FIELDS,
    })
    return adaptCart(cart as unknown as MedusaCart)
  } catch {
    return null
  }
}

export async function addLineItem(
  cartId: string,
  variantId: string,
  quantity: number
): Promise<AdaptedCart> {
  const { cart } = await medusa.store.cart.createLineItem(
    cartId,
    { variant_id: variantId, quantity },
    { fields: CART_FIELDS }
  )
  return adaptCart(cart as unknown as MedusaCart)
}

export async function updateLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<AdaptedCart> {
  const { cart } = await medusa.store.cart.updateLineItem(
    cartId,
    lineItemId,
    { quantity },
    { fields: CART_FIELDS }
  )
  return adaptCart(cart as unknown as MedusaCart)
}

export async function removeLineItem(
  cartId: string,
  lineItemId: string
): Promise<void> {
  await medusa.store.cart.deleteLineItem(cartId, lineItemId)
}

export interface CompleteCartResult {
  type: "order" | "cart"
  orderId?: string
  error?: string
}

export interface CompleteAddress {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
}

export interface CompleteCartInput {
  email?: string | null
  address?: CompleteAddress | null
  metadata?: Record<string, unknown>
}

/**
 * Complete a Medusa cart into a paid Medusa order.
 *
 * Kustom handled the actual payment in its iframe, so we drive Medusa's own
 * checkout to mint a matching order: set email + addresses (from the Kustom
 * order), pick a shipping method, create a payment session with the system/
 * manual provider (pp_system_default — on every region from the seed), then
 * complete. The Kustom order id is recorded in the order metadata.
 *
 * Returns gracefully on any failure so the push handler can still ACK Kustom.
 */
export async function completeCart(
  cartId: string,
  input: CompleteCartInput = {}
): Promise<CompleteCartResult> {
  // Build a safe address (Medusa requires the required fields to complete).
  const a = input.address ?? {}
  const address = {
    first_name: a.first_name || "Hoodtopia",
    last_name: a.last_name || "Customer",
    address_1: a.address_1 || "N/A",
    city: a.city || "N/A",
    postal_code: a.postal_code || "00000",
    country_code: (a.country_code || "us").toLowerCase(),
  }

  // 1. Email + shipping/billing addresses + metadata.
  await medusa.store.cart.update(cartId, {
    email: input.email || "demo@hoodtopia.co",
    shipping_address: address,
    billing_address: address,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  })

  // 2. Pick the first shipping option available for this cart.
  const { shipping_options } = await medusa.store.fulfillment.listCartOptions({
    cart_id: cartId,
  })
  if (!shipping_options?.length) {
    return { type: "cart", error: "no shipping options for cart" }
  }
  await medusa.store.cart.addShippingMethod(cartId, {
    option_id: shipping_options[0].id,
  })

  // 3. Payment session with the system/manual provider (auto-authorizes).
  const { cart } = await medusa.store.cart.retrieve(cartId)
  await medusa.store.payment.initiatePaymentSession(cart, {
    provider_id: "pp_system_default",
  })

  // 4. Complete.
  const res = await medusa.store.cart.complete(cartId)
  if (res.type === "order") {
    // Cart metadata isn't copied to the order, so stamp the Kustom order id
    // (and any other correlation data) onto the order itself via the admin API.
    if (input.metadata) {
      try {
        await medusaAdmin.admin.order.update(res.order.id, {
          metadata: input.metadata,
        })
      } catch {
        // Non-fatal: the order exists; metadata is best-effort correlation.
      }
    }
    return { type: "order", orderId: res.order.id }
  }
  return { type: "cart", error: res.error?.message ?? "cart not completed" }
}
