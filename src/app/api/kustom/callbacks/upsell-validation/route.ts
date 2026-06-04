import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { getStockBySku } from "@/lib/commerce/medusa-products";
import type { UpsellLine } from "@/lib/kustom/types";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Final stock check before Kustom appends the upsell to the captured order.
// Inventory now lives in Medusa, which reserves stock when the items are added
// to the order — so here we just verify each upsell SKU still has enough stock
// (no manual decrement). Reject all-or-nothing if any line is short.
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyCallbackToken("upsell_validation", url.searchParams.get("token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { upsell_lines?: UpsellLine[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Narrow to lines with a SKU reference — reference is recommended-not-required
  // in the spec so the type is optional, but we can't look up stock without one.
  const lines = (body.upsell_lines ?? []).filter(
    (l): l is typeof l & { reference: string } =>
      typeof l.reference === "string" && l.reference.length > 0 && l.quantity > 0
  );
  if (lines.length === 0) return NextResponse.json({});

  const stockBySku = await getStockBySku(lines.map((l) => l.reference));

  const short = lines.find((line) => {
    const stock = stockBySku.get(line.reference);
    return stock === undefined || stock < line.quantity;
  });

  if (short) {
    return NextResponse.json(
      {
        error_type: "unavailable_shipping_address",
        error_message: `Sorry — ${short.name} is no longer available.`,
      },
      { status: 400 }
    );
  }

  try {
    await track("upsell_accepted", {
      skus: lines.map((l) => l.reference).join(","),
      count: lines.length,
    });
  } catch { /* swallow */ }

  return NextResponse.json({});
}
