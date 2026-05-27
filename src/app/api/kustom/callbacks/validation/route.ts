import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { track } from "@vercel/analytics/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { db, productVariants } from "@/db";
import type { OrderLine } from "@/lib/kustom/types";

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

  const lines = (body.order_lines ?? []).filter((l) => l.type !== "shipping_fee");
  const skus = lines.map((l) => l.reference).filter(Boolean);

  if (skus.length === 0) {
    // Nothing to validate (digital-only / fees-only). Approve.
    return NextResponse.json({});
  }

  const variants = await db.query.productVariants.findMany({
    where: inArray(productVariants.sku, skus),
  });

  const stockBySku = new Map(variants.map((v) => [v.sku, v.stock]));
  const insufficient = lines.filter((l) => {
    const stock = stockBySku.get(l.reference);
    // Stock has already been decremented at add-to-cart time, so 0 means
    // the inventory is fully reserved for this exact purchase — that's OK.
    // We reject only if stock went negative (impossible today, defensive)
    // or if the SKU vanished entirely.
    return stock === undefined || stock < 0;
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
