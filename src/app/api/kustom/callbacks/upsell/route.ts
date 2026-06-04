import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { listProducts } from "@/lib/commerce/medusa-products";
import { getCartRecommendations } from "@/services/ai";
import { currencySymbol } from "@/lib/kustom/currency";
import type { OrderLine, UpsellLine } from "@/lib/kustom/types";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// THE agentic-commerce moment. Kustom calls us on the confirmation page asking
// "any post-purchase upsells?". We look up what the customer just bought,
// hand it to the AI rec engine, and turn the top complementary product into
// a Kustom upsell_line. The user sees it inside Kustom's confirmation iframe
// and can one-click add it before the upsell window closes.
//
// VAT inclusive — we match the order's currency for the symbol so the AI
// description reads naturally (kr / £ / etc).
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyCallbackToken("upsell", url.searchParams.get("token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    upsell_possible?: boolean;
    max_upsell_amount?: number;
    order_lines?: OrderLine[];
    purchase_currency?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.upsell_possible === false) {
    return NextResponse.json({ upsell_lines: [], empty: true });
  }

  const purchased = (body.order_lines ?? [])
    .filter((l) => (l.type === "physical" || l.type === "digital") && l.reference)
    .map((l) => l.reference);

  if (purchased.length === 0) {
    return NextResponse.json({ upsell_lines: [], empty: true });
  }

  // Map SKUs → Medusa products so the AI has full context.
  const catalog = await listProducts();
  const purchasedSet = new Set(purchased);
  const purchasedProducts = catalog.filter((p) =>
    p.variants.some((v) => purchasedSet.has(v.sku))
  );
  if (purchasedProducts.length === 0) {
    return NextResponse.json({ upsell_lines: [], empty: true });
  }

  const currency = body.purchase_currency ?? "GBP";
  const symbol = currencySymbol(currency).trim();
  const maxAmount = body.max_upsell_amount ?? Infinity;

  const recs = await getCartRecommendations(purchasedProducts, catalog, {
    symbol,
    budgetCap: 50,
  });

  // Pick the top complementary product that (a) has a variant in stock and
  // (b) fits under max_upsell_amount.
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

  if (upsell_lines.length === 0) {
    return NextResponse.json({ upsell_lines: [], empty: true });
  }

  // 10-minute upsell window.
  const last_upsell_time = new Date(Date.now() + 10 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  try {
    await track("upsell_offered", {
      purchasedSkus: purchased.join(","),
      offeredSkus: upsell_lines.map((l) => l.reference).join(","),
      currency,
      count: upsell_lines.length,
    });
  } catch { /* swallow */ }

  return NextResponse.json({ upsell_lines, last_upsell_time });
}
