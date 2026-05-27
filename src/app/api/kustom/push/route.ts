import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { track } from "@vercel/analytics/server";
import { db, orders } from "@/db";
import { kustom } from "@/lib/kustom/client";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Kustom POSTs here after a customer completes checkout (~2 min delay).
// Steps: fetch the Order Management order → upsert locally → acknowledge.
// Always return 200 quickly so Kustom doesn't retry on transient errors
// (5/15/30/60 min then every 4h for 48h on any non-2xx).
export async function POST(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");

  if (!orderId) {
    console.warn("[kustom/push] missing order_id query param — Kustom never sends this; likely a probe");
    return NextResponse.json({ ok: false, error: "missing order_id" });
  }

  try {
    const mgmt = await kustom.getManagementOrder(orderId);

    const existing = await db.query.orders.findFirst({
      where: eq(orders.kustomOrderId, orderId),
    });

    const totalAmount = mgmt.order_amount ?? 0;
    const currency = mgmt.purchase_currency ?? "SEK";
    const customerEmail = mgmt.billing_address?.email ?? null;
    const snapshotJson = JSON.stringify(mgmt);

    if (existing) {
      await db
        .update(orders)
        .set({
          status: mgmt.status,
          totalAmount,
          currency,
          customerEmail,
          snapshotJson,
        })
        .where(eq(orders.kustomOrderId, orderId));
    } else {
      await db.insert(orders).values({
        id: uuidv4(),
        kustomOrderId: orderId,
        status: mgmt.status,
        totalAmount,
        currency,
        customerEmail,
        sessionId: "demo-session",
        snapshotJson,
      });
    }

    await kustom.acknowledgeOrder(orderId);

    await db
      .update(orders)
      .set({ acknowledgedAt: new Date() })
      .where(eq(orders.kustomOrderId, orderId));

    // Fire purchase_completed on Vercel Analytics. Server-side track is
    // fire-and-forget; await so any error is logged in this try block.
    try {
      await track("purchase_completed", {
        orderId,
        total: totalAmount,
        currency,
        country: mgmt.purchase_country ?? "",
        itemCount: (mgmt.order_lines ?? []).filter((l) => l.type !== "shipping_fee").length,
      });
    } catch (analyticsErr) {
      console.warn("[kustom/push] analytics track failed", analyticsErr);
    }
  } catch (err) {
    // Log but still 200 — retries won't help for malformed responses, and we'd rather
    // investigate via logs than have Kustom hammer us for 48h.
    console.error("[kustom/push] sync failed", err);
  }

  return NextResponse.json({ ok: true });
}
