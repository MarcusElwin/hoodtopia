import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { getStockBySku } from "@/lib/commerce/medusa-products";
import type { OrderLine } from "@/lib/kustom/types";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Pre-payment guardrail. Kustom calls this just before authorising payment
// (require_validate_callback_success=true in the create-order options).
// Return 200 to approve, 400 to reject with a customer-visible reason.
//
// We use it to catch the demo's flagship failure mode: another shopper
// drained the last unit between add-to-cart and checkout. The cart had it
// reserved locally; we double-check against current stock at the last
// moment.
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyCallbackToken("validation", url.searchParams.get("token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { order_lines?: OrderLine[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Only validate real product lines. Discount / shipping_fee / sales_tax
  // lines carry non-SKU references (e.g. a promo code) and must be skipped —
  // otherwise the discount line's code gets stock-checked and rejected.
  const lines = (body.order_lines ?? []).filter(
    (l) => l.type === "physical" || l.type === "digital"
  );
  const skus = lines.map((l) => l.reference).filter(Boolean);

  if (skus.length === 0) {
    // Nothing to validate (digital-only / fees-only). Approve.
    return NextResponse.json({});
  }

  // Re-check stock against Medusa (the inventory source) at payment time.
  const stockBySku = await getStockBySku(skus as string[]);
  const insufficient = lines.filter((l) => {
    const stock = stockBySku.get(l.reference as string);
    // Reject only if the SKU genuinely has no stock left. Custom-design SKUs
    // don't manage inventory and come back as MAX_SAFE_INTEGER. A missing SKU
    // (undefined) is treated as out-of-stock.
    return stock === undefined || stock <= 0;
  });

  if (insufficient.length > 0) {
    try {
      await track("stock_validation_failed", {
        skus: insufficient.map((l) => l.reference).join(","),
        names: insufficient.map((l) => l.name).join(", "),
      });
    } catch { /* swallow */ }
    return NextResponse.json(
      {
        error_type: "unavailable_shipping_address",
        error_message: `Sorry — one of the items in your cart is no longer available (${insufficient
          .map((l) => l.name)
          .join(", ")}).`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({});
}
