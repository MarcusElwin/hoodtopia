import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { db, productVariants } from "@/db";
import type { UpsellLine } from "@/lib/kustom/types";

// Final stock check before Kustom appends the upsell to the captured order.
// Same shape as /validation — 200 = approve, 400 = reject.
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

  const lines = body.upsell_lines ?? [];
  if (lines.length === 0) return NextResponse.json({});

  const skus = lines.map((l) => l.reference).filter(Boolean);
  const variants = await db.query.productVariants.findMany({
    where: inArray(productVariants.sku, skus),
  });
  const stockBySku = new Map(variants.map((v) => [v.sku, v.stock]));

  const insufficient = lines.find((l) => (stockBySku.get(l.reference) ?? 0) < l.quantity);
  if (insufficient) {
    return NextResponse.json(
      {
        error_type: "unavailable_shipping_address",
        error_message: `Sorry — ${insufficient.name} just sold out.`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({});
}
