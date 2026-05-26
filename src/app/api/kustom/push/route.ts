import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { kustom } from "@/lib/kustom/client";

// Kustom POSTs here after a customer completes checkout (~2 min delay).
// Steps: fetch the Order Management order → upsert locally → acknowledge.
// Always return 200 quickly so Kustom doesn't retry on transient errors.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "missing order_id" }, { status: 400 });
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
  } catch (err) {
    // Log but still 200 — retries won't help for malformed responses, and we'd rather
    // investigate via logs than have Kustom hammer us for 48h.
    console.error("[kustom/push] sync failed", err);
  }

  return NextResponse.json({ ok: true });
}
