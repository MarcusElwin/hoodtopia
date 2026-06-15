import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { buildUpsell, type UpsellRequest } from "@/lib/kustom/upsell";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// THE agentic-commerce moment. Kustom calls us on the confirmation page asking
// "any post-purchase upsells?". We look up what the customer just bought,
// hand it to the AI rec engine, and turn the top complementary products into
// Kustom upsell_lines. The user sees them inside Kustom's confirmation iframe
// and can one-click add before the upsell window closes.
//
// The recommendation logic lives in `@/lib/kustom/upsell` so the authenticated
// REST variant (`/api/upsell`) returns identical results. This route only adds
// the Kustom-specific HMAC token check + analytics.
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyCallbackToken("upsell", url.searchParams.get("token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: UpsellRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await buildUpsell(body);
  if (result.warnings.length > 0) {
    console.warn(`[upsell:callback] ${result.warnings.join(" | ")}`);
  }
  if (result.empty) {
    return NextResponse.json({ upsell_lines: [], empty: true });
  }

  try {
    await track("upsell_offered", {
      purchasedSkus: result.purchased.join(","),
      offeredSkus: result.upsell_lines.map((l) => l.reference).join(","),
      currency: result.currency,
      count: result.upsell_lines.length,
      source: result.source,
    });
  } catch { /* swallow */ }

  return NextResponse.json({
    upsell_lines: result.upsell_lines,
    last_upsell_time: result.last_upsell_time,
  });
}
