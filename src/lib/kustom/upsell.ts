import "server-only";
import { listProducts } from "@/lib/commerce/medusa-products";
import { getCartRecommendations } from "@/services/ai";
import { currencySymbol } from "@/lib/kustom/currency";
import type { OrderLine, UpsellLine } from "@/lib/kustom/types";

// Shared upsell engine. Given the lines a customer just bought, map them to the
// Medusa catalog, ask the AI rec engine for complementary products, and shape
// the top in-stock / in-budget picks into Kustom `upsell_lines[]`.
//
// Two callers share this:
//   - the unauthenticated Kustom confirmation-page callback
//     (`/api/kustom/callbacks/upsell`, gated by an HMAC URL token)
//   - the authenticated REST endpoint (`/api/upsell`, gated by a Bearer JWT)
// Keeping the logic here means both surfaces return identical recommendations.

export interface UpsellRequest {
  upsell_possible?: boolean;
  max_upsell_amount?: number;
  order_lines?: OrderLine[];
  purchase_currency?: string;
}

export interface UpsellResult {
  upsell_lines: UpsellLine[];
  last_upsell_time?: string;
  /** SKUs of the purchased items the recommendations were based on. */
  purchased: string[];
  /** Resolved currency (defaults to GBP). */
  currency: string;
  /** true when there's nothing to offer — Kustom expects {upsell_lines:[],empty:true}. */
  empty: boolean;
}

export async function buildUpsell(body: UpsellRequest): Promise<UpsellResult> {
  const currency = body.purchase_currency ?? "GBP";
  const nothing = (purchased: string[] = []): UpsellResult => ({
    upsell_lines: [],
    purchased,
    currency,
    empty: true,
  });

  if (body.upsell_possible === false) return nothing();

  const purchased = (body.order_lines ?? [])
    .filter((l) => (l.type === "physical" || l.type === "digital") && l.reference)
    .map((l) => l.reference);

  if (purchased.length === 0) return nothing();

  // Map SKUs → Medusa products so the AI has full context.
  const catalog = await listProducts();
  const purchasedSet = new Set(purchased);
  const purchasedProducts = catalog.filter((p) =>
    p.variants.some((v) => purchasedSet.has(v.sku))
  );
  if (purchasedProducts.length === 0) return nothing(purchased);

  const symbol = currencySymbol(currency).trim();
  const maxAmount = body.max_upsell_amount ?? Infinity;

  const recs = await getCartRecommendations(purchasedProducts, catalog, {
    symbol,
    budgetCap: 50,
  });

  // Pick the top complementary products that (a) have a variant in stock and
  // (b) fit under max_upsell_amount.
  const upsell_lines: UpsellLine[] = [];
  for (const rec of recs.recommendations) {
    if (!rec.product) continue;
    const full = catalog.find((p) => p.id === rec.product!.id);
    const variant = full?.variants?.find((v) => v.stock > 0);
    if (!variant) continue;
    if (full!.basePrice > maxAmount) continue;

    // VAT-inclusive math, matching cart-mapper.
    const total_amount = full!.basePrice;
    const total_tax_amount = Math.round(total_amount - total_amount / 1.2);

    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const productUrl = site ? `${site}/products/${full!.slug}` : undefined;

    // image_url MUST be absolute — Kustom's iframe is on *.kustom.co so a
    // relative path like /images/accessories/foo.jpg resolves to their host
    // and 404s (visible as a broken-image icon in the upsell tile).
    const rawImageUrl = variant.imageUrl ?? full!.imageUrl;
    const absoluteImage =
      rawImageUrl && rawImageUrl.startsWith("http")
        ? rawImageUrl
        : site && rawImageUrl
          ? `${site}${rawImageUrl.startsWith("/") ? "" : "/"}${rawImageUrl}`
          : undefined;

    // Spec caps image_url / product_url / description at 1024 chars.
    const safeImage =
      absoluteImage && absoluteImage.length <= 1024 ? absoluteImage : undefined;
    const safeProductUrl =
      productUrl && productUrl.length <= 1024 ? productUrl : undefined;

    upsell_lines.push({
      name: full!.name.slice(0, 255), // spec: max 255
      reference: variant.sku,
      quantity: 1,
      max_allowed_quantity: Math.min(variant.stock, 3),
      quantity_unit: "pcs",
      unit_price: full!.basePrice,
      tax_rate: 2000,
      total_amount,
      total_tax_amount,
      image_url: safeImage,
      product_url: safeProductUrl,
      description: full!.description?.slice(0, 1024),
      type: "physical",
    });
    // Show all AI-picked recs (capped at 5 to keep the iframe tight and
    // avoid hitting Kustom's per-callback line limit).
    if (upsell_lines.length >= 5) break;
  }

  if (upsell_lines.length === 0) return nothing(purchased);

  // 10-minute upsell window.
  const last_upsell_time = new Date(Date.now() + 10 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  return { upsell_lines, last_upsell_time, purchased, currency, empty: false };
}
