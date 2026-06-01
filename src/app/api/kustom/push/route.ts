import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { kustom } from "@/lib/kustom/client";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { DEMO_SESSION_ID, getOrCreateCartId, resetCart } from "@/lib/commerce/cart-session";
import { completeCart } from "@/lib/commerce/medusa-cart";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Kustom POSTs here after a customer completes checkout (~2 min delay).
// Steps: fetch the Order Management order → upsert locally → acknowledge.
// For *authenticated* pushes we always return 200 quickly so Kustom doesn't
// retry on transient errors (5/15/30/60 min then every 4h for 48h on any
// non-2xx). Forged requests are rejected with 401 below — a real Kustom push
// always carries the token we baked into merchant_urls.push, so it never hits
// that path.
export async function POST(request: Request) {
  const url = new URL(request.url);

  // Reject forged push requests. Skip the check only when no callback secret
  // is configured (demo/dev boxes), matching the merchant_urls behaviour where
  // the token is omitted entirely in that case.
  if (
    process.env.KUSTOM_CALLBACK_SECRET &&
    !verifyCallbackToken("push", url.searchParams.get("token"))
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orderId = url.searchParams.get("order_id");

  if (!orderId) {
    console.warn("[kustom/push] missing order_id query param — Kustom never sends this; likely a probe");
    return NextResponse.json({ ok: false, error: "missing order_id" });
  }

  try {
    const mgmt = await kustom.getManagementOrder(orderId);

    const totalAmount = mgmt.order_amount ?? 0;
    const currency = mgmt.purchase_currency ?? "SEK";

    // Kustom took payment; now complete the corresponding Medusa cart into a
    // paid Medusa order (Medusa is the order source of truth). The session's
    // cart_id is resolved from the mapping; the Kustom order id is recorded in
    // the Medusa order metadata for correlation. Completing the cart releases
    // the session pointer so the shopper starts fresh.
    try {
      const cartId = await getOrCreateCartId(DEMO_SESSION_ID);
      const addr = mgmt.shipping_address ?? mgmt.billing_address ?? null;
      const result = await completeCart(cartId, {
        email: mgmt.billing_address?.email ?? null,
        address: addr
          ? {
              first_name: addr.given_name ?? null,
              last_name: addr.family_name ?? null,
              address_1: addr.street_address ?? null,
              city: addr.city ?? null,
              postal_code: addr.postal_code ?? null,
              country_code: addr.country ?? mgmt.purchase_country ?? null,
            }
          : null,
        metadata: {
          kustom_order_id: orderId,
          kustom_status: mgmt.status,
        },
      });
      if (result.type === "order") {
        console.log("[kustom/push] completed Medusa order %s for kustom %s",
          result.orderId, orderId);
        await resetCart(DEMO_SESSION_ID);
      } else {
        console.warn("[kustom/push] cart not completed for %s: %s",
          orderId, result.error);
      }
    } catch (medusaErr) {
      console.error("[kustom/push] Medusa cart completion failed", medusaErr);
    }

    await kustom.acknowledgeOrder(orderId);

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
