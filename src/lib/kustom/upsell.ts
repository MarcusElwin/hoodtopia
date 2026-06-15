import "server-only";
import { listProducts } from "@/lib/commerce/medusa-products";
import { getCartRecommendations } from "@/services/ai";
import { currencySymbol } from "@/lib/kustom/currency";
import type { AdaptedProduct } from "@/lib/commerce/product-adapter";
import type { ProductVariant } from "@/db/schema";
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
//
// Resilience: we ALWAYS try to return recommendations for any cart. If the AI
// can't help (unknown SKUs, AI error, or no in-budget complement), we fall back
// to deterministic catalog picks. The only hard-empty cases are an unreachable
// catalog or a catalog with nothing in stock/budget. Every degradation is
// recorded in `warnings[]` so the caller can log it server-side.

export interface UpsellRequest {
  upsell_possible?: boolean;
  max_upsell_amount?: number;
  order_lines?: OrderLine[];
  purchase_currency?: string;
}

// How the returned lines were produced:
//   "ai"        — AI complementary recommendations
//   "fallback"  — deterministic catalog picks (AI unavailable / unhelpful)
//   "none"      — nothing to offer
export type UpsellSource = "ai" | "fallback" | "none";

export interface UpsellResult {
  upsell_lines: UpsellLine[];
  last_upsell_time?: string;
  /** SKUs of the purchased items the recommendations were based on. */
  purchased: string[];
  /** Resolved currency (defaults to GBP). */
  currency: string;
  /** true when there's nothing to offer — Kustom expects {upsell_lines:[],empty:true}. */
  empty: boolean;
  /** Which path produced the lines. */
  source: UpsellSource;
  /** Non-fatal issues encountered (unknown SKUs, AI failure, …) for server logs. */
  warnings: string[];
}

const MAX_LINES = 5;
const BUDGET_CAP = 50;

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function inStockVariant(p: AdaptedProduct): ProductVariant | undefined {
  return p.variants?.find((v) => v.stock > 0);
}

// Turn one product + in-stock variant into a Kustom upsell_line.
// `taxRate` is in basis points (2000 = 20%) and `vatDivisor` is the matching
// VAT-inclusive divisor (1.2 for 20%) — both derived from the order's market so
// upsell lines stay consistent with what the customer actually bought.
function shapeLine(
  full: AdaptedProduct,
  variant: ProductVariant,
  taxRate: number,
  vatDivisor: number
): UpsellLine {
  // VAT-inclusive math, matching cart-mapper.
  const total_amount = full.basePrice;
  const total_tax_amount = Math.round(total_amount - total_amount / vatDivisor);

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const productUrl = site ? `${site}/products/${full.slug}` : undefined;

  // image_url MUST be absolute — Kustom's iframe is on *.kustom.co so a relative
  // path like /images/accessories/foo.jpg resolves to their host and 404s.
  const rawImageUrl = variant.imageUrl ?? full.imageUrl;
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

  return {
    name: full.name.slice(0, 255), // spec: max 255
    reference: variant.sku,
    quantity: 1,
    max_allowed_quantity: Math.min(variant.stock, 3),
    quantity_unit: "pcs",
    unit_price: full.basePrice,
    tax_rate: taxRate,
    total_amount,
    total_tax_amount,
    image_url: safeImage,
    product_url: safeProductUrl,
    description: full.description?.slice(0, 1024),
    type: "physical",
  };
}

export async function buildUpsell(body: UpsellRequest): Promise<UpsellResult> {
  const warnings: string[] = [];
  const currency = body.purchase_currency ?? "GBP";
  const maxAmount = body.max_upsell_amount ?? Infinity;

  const finish = (
    upsell_lines: UpsellLine[],
    source: UpsellSource,
    purchased: string[]
  ): UpsellResult => {
    if (upsell_lines.length === 0) {
      return { upsell_lines: [], purchased, currency, empty: true, source: "none", warnings };
    }
    // 10-minute upsell window.
    const last_upsell_time = new Date(Date.now() + 10 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z");
    return { upsell_lines, last_upsell_time, purchased, currency, empty: false, source, warnings };
  };

  // Guard against malformed payloads on the standalone REST endpoint: a client
  // could send order_lines as a non-array, or with non-object entries. Coerce to
  // a safe array of objects so the filter/map below never throws at runtime.
  const orderLines = Array.isArray(body.order_lines)
    ? body.order_lines.filter(
        (l): l is OrderLine => typeof l === "object" && l !== null
      )
    : [];
  if (body.order_lines != null && !Array.isArray(body.order_lines)) {
    warnings.push("order_lines was not an array — ignoring it");
  }

  const purchased = orderLines
    .filter((l) => (l.type === "physical" || l.type === "digital") && l.reference)
    .map((l) => l.reference);

  // Derive the market's VAT from the order lines so upsell lines match the
  // customer's tax_rate (GB=2000, SE=2500, US=0, …) instead of a hard-coded 20%.
  // Prefer a taxed physical/digital line; default to 20% when none is present.
  const taxedLine = orderLines.find(
    (l) =>
      (l.type === "physical" || l.type === "digital") &&
      typeof l.tax_rate === "number"
  );
  const taxRate = taxedLine?.tax_rate ?? 2000;
  const vatDivisor = 1 + taxRate / 10000;

  // upsell_possible=false is Kustom telling us the upsell slot is unavailable —
  // honour it even with fallbacks on, or Kustom may reject the response.
  if (body.upsell_possible === false) {
    warnings.push("upsell_possible=false — Kustom signalled the upsell window is closed");
    return finish([], "none", purchased);
  }

  if (purchased.length === 0) {
    warnings.push("request had no physical/digital order_lines with a SKU reference");
  }

  // The catalog is the one hard dependency — without it we can't recommend.
  let catalog: AdaptedProduct[];
  try {
    // Pass the order's currency so Medusa prices in the matching region when one
    // exists (falls back to the default region otherwise) — keeps basePrice,
    // max_upsell_amount filtering, and the AI prompt prices consistent.
    catalog = await listProducts({ currencyCode: currency });
  } catch (err) {
    warnings.push(`catalog lookup failed: ${errMessage(err)}`);
    return finish([], "none", purchased);
  }

  const purchasedSet = new Set(purchased);
  const purchasedProducts = catalog.filter((p) =>
    p.variants.some((v) => purchasedSet.has(v.sku))
  );
  if (purchased.length > 0 && purchasedProducts.length === 0) {
    warnings.push(
      `none of the ${purchased.length} cart SKU(s) matched the catalog — using generic picks`
    );
  }

  const symbol = currencySymbol(currency).trim();
  const fitsBudget = (p: AdaptedProduct) => p.basePrice <= maxAmount;
  const notPurchased = (p: AdaptedProduct) =>
    !purchasedProducts.some((pp) => pp.id === p.id);

  // 1. Primary path: AI complementary recommendations (needs cart context).
  if (purchasedProducts.length > 0) {
    try {
      const recs = await getCartRecommendations(purchasedProducts, catalog, {
        symbol,
        budgetCap: BUDGET_CAP,
      });
      const lines: UpsellLine[] = [];
      for (const rec of recs.recommendations) {
        if (!rec.product) continue;
        const full = catalog.find((p) => p.id === rec.product!.id);
        if (!full || !fitsBudget(full)) continue;
        const variant = inStockVariant(full);
        if (!variant) continue;
        lines.push(shapeLine(full, variant, taxRate, vatDivisor));
        if (lines.length >= MAX_LINES) break;
      }
      if (lines.length > 0) return finish(lines, "ai", purchased);
      warnings.push("AI returned no in-stock, in-budget complement — using generic picks");
    } catch (err) {
      warnings.push(`AI recommendation failed: ${errMessage(err)} — using generic picks`);
    }
  }

  // 2. Fallback: deterministic catalog picks so we always return something.
  //    Cheapest in-stock, in-budget products the customer didn't already buy —
  //    naturally surfaces affordable add-ons (beanies, socks, …).
  const fallback = catalog
    .filter((p) => notPurchased(p) && fitsBudget(p) && inStockVariant(p))
    .sort((a, b) => a.basePrice - b.basePrice)
    .slice(0, MAX_LINES)
    .map((p) => shapeLine(p, inStockVariant(p)!, taxRate, vatDivisor));

  if (fallback.length === 0) {
    warnings.push("no in-stock, in-budget catalog products available to offer");
  }
  return finish(fallback, fallback.length > 0 ? "fallback" : "none", purchased);
}
