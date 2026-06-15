import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { verifyUpsellBearer } from "@/lib/kustom/upsell-auth";
import { buildUpsell, type UpsellRequest } from "@/lib/kustom/upsell";

// Force runtime execution — this route hits the DB / AI engine; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Authenticated REST sibling of the Kustom confirmation-page upsell callback.
//
// Same AI recommendation engine (`buildUpsell`) and same response shape, but
// gated by a Bearer token instead of a Kustom HMAC URL token — so our own
// clients / partners can fetch upsell recommendations directly (e.g. while
// onboarding and testing the upsell experience outside the Kustom checkout
// iframe).
//
// The bearer accepts either the static UPSELL_API_KEY (simplest — for partner
// onboarding) or a short-lived JWT from POST /api/upsell/auth. See
// `verifyUpsellBearer` in lib/kustom/upsell-auth.ts.
//
//   Authorization: Bearer <UPSELL_API_KEY | token from POST /api/upsell/auth>
//   body: { order_lines, max_upsell_amount?, purchase_currency?, upsell_possible? }
//   → { upsell_lines, last_upsell_time } | { upsell_lines: [], empty: true }
export async function POST(request: Request) {
  if (!(await verifyUpsellBearer(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Reject non-object payloads (array/string/number/null) before treating them
  // as an upsell request — otherwise downstream property access can 500.
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = raw as UpsellRequest;

  const result = await buildUpsell(body);
  if (result.warnings.length > 0) {
    console.warn(`[upsell:api] ${result.warnings.join(" | ")}`);
  }
  if (result.empty) {
    return NextResponse.json({ upsell_lines: [], empty: true });
  }

  try {
    await track("upsell_api_offered", {
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
