import { NextResponse } from "next/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { recomputeOrder } from "@/lib/kustom/recompute";
import type { OrderLine, ShippingOption } from "@/lib/kustom/types";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Called when the user picks a different shipping option from the list KSA
// returned. Kustom hands us the new selected_shipping_option; we make sure
// the corresponding shipping_fee order line is in the response and re-sum.
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyCallbackToken("shipping_option", url.searchParams.get("token"))) {
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
