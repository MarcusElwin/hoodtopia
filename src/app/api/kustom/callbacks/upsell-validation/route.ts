import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { track } from "@vercel/analytics/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { db, productVariants } from "@/db";
import type { UpsellLine } from "@/lib/kustom/types";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Final stock check + atomic reservation before Kustom appends the upsell to
// the captured order. Upsells bypass the cart, so unlike normal items they
// haven't decremented stock yet — we have to do it here, atomically, or the
// same scarce variant could be sold to N customers in a row.
//
// On reject we restore anything we already decremented in this batch so the
// failure mode is "all-or-nothing".
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

  // Map SKU → variantId once so we can target updates by primary key.
  const variants = await db.query.productVariants.findMany({
    where: inArray(productVariants.sku, lines.map((l) => l.reference)),
  });
  const variantBySku = new Map(variants.map((v) => [v.sku, v]));

  const decremented: Array<{ variantId: string; quantity: number }> = [];

  for (const line of lines) {
    const variant = variantBySku.get(line.reference);
    if (!variant) {
      // Restore anything reserved so far before rejecting.
      for (const d of decremented) {
        await db
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${d.quantity}` })
          .where(eq(productVariants.id, d.variantId));
      }
      return NextResponse.json(
        {
          error_type: "unavailable_shipping_address",
          error_message: `Sorry — ${line.name} is no longer available.`,
        },
        { status: 400 }
      );
    }

    const result = await db
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
      .where(
        and(
          eq(productVariants.id, variant.id),
          sql`${productVariants.stock} - ${line.quantity} >= 0`
        )
      )
      .run();

    if (result.rowsAffected === 0) {
      // Stock raced out between recommendation and click — roll back.
      for (const d of decremented) {
        await db
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${d.quantity}` })
          .where(eq(productVariants.id, d.variantId));
      }
      return NextResponse.json(
        {
          error_type: "unavailable_shipping_address",
          error_message: `Sorry — ${line.name} just sold out.`,
        },
        { status: 400 }
      );
    }

    decremented.push({ variantId: variant.id, quantity: line.quantity });
  }

  try {
    await track("upsell_accepted", {
      skus: lines.map((l) => l.reference).join(","),
      count: lines.length,
    });
  } catch { /* swallow */ }

  return NextResponse.json({});
}
