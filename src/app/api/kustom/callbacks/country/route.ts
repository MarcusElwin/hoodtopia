import { NextResponse } from "next/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { recomputeOrder } from "@/lib/kustom/recompute";
import type { OrderLine, ShippingOption } from "@/lib/kustom/types";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Fires when the consumer switches the purchase country. Kustom has already
// re-priced the order in the new currency by the time we get the call; we
// just re-sum and pass back. For a real merchant this is where you'd swap
// tax tables, currency conversion rules, etc.
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyCallbackToken("country", url.searchParams.get("token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    order_lines?: OrderLine[];
    purchase_currency?: string;
    selected_shipping_option?: ShippingOption;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.order_lines || !body.purchase_currency) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  return NextResponse.json(
    recomputeOrder({
      order_lines: body.order_lines,
      purchase_currency: body.purchase_currency,
      selected_shipping_option: body.selected_shipping_option,
    })
  );
}
