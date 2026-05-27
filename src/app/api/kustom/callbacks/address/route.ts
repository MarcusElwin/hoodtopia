import { NextResponse } from "next/server";
import { verifyCallbackToken } from "@/lib/kustom/callback-auth";
import { recomputeOrder } from "@/lib/kustom/recompute";
import type { OrderLine, ShippingOption } from "@/lib/kustom/types";

// Kustom calls this whenever the consumer edits billing/shipping address.
// We recompute totals from the line items they sent us. Tax/shipping changes
// driven by the new address are out of scope for this demo — we trust Kustom's
// per-line tax math here. See docs/KUSTOM_INTEGRATION.md.
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyCallbackToken("address", url.searchParams.get("token"))) {
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
