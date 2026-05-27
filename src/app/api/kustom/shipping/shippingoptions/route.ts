import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearer } from "@/lib/kustom/shipping-auth";
import { buildShippingOptions } from "@/lib/kustom/shipping-options";

// Force runtime — DB-free but still dynamic (depends on inbound payload).
export const dynamic = "force-dynamic";

// POST /shippingoptions — Kustom Shipping Assistant asks the Integrator
// (us) for available shipping options. Spec docs:
//   https://docs.kustom.co/contents/checkout/shipping-assistant/api-integration
//
// Path is /shippingoptions (no underscore, no /options) — the portal's
// "TMS configuration → Endpoint" is the base URL and Kustom appends this
// suffix. We previously had /options which 404'd, hence the
// "Failed to fetch option from aggregator" fallback shown in the portal.

const addressSchema = z
  .object({
    given_name: z.string().optional(),
    family_name: z.string().optional(),
    street_address: z.string().optional(),
    postal_code: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    customer_type: z.string().optional(),
  })
  .partial();

const orderLineSchema = z
  .object({
    type: z.string().optional(),
    reference: z.string().optional(),
    quantity: z.number().optional(),
    unit_price: z.number().optional(),
    tax_rate: z.number().optional(),
    total_tax_amount: z.number().optional(),
    total_price_including_tax: z.number().optional(),
  })
  .partial()
  .passthrough();

const requestSchema = z
  .object({
    session_id: z.string().optional(),
    locale: z.string().optional(),
    currency: z.string().optional(),
    recipient: addressSchema.optional(),
    // Some tools send shipping_address/billing_address instead of recipient.
    shipping_address: addressSchema.optional(),
    billing_address: addressSchema.optional(),
    purchase_country: z.string().optional(),
    order: z
      .object({
        id: z.string().optional(),
        total_amount: z.number().optional(),
        total_tax: z.number().optional(),
        lines: z.array(orderLineSchema).optional(),
        total_amount_without_shipping_fee: z.number().optional(),
        total_tax_without_shipping_fee: z.number().optional(),
      })
      .partial()
      .optional(),
    // Legacy field some create-order paths set directly.
    order_amount: z.number().optional(),
    order_lines: z.array(orderLineSchema).optional(),
  })
  .partial();

export async function POST(request: Request) {
  const auth = await verifyBearer(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const recipient = body.recipient ?? body.shipping_address ?? body.billing_address;
  const country =
    recipient?.country?.toUpperCase() ?? body.purchase_country?.toUpperCase();
  const orderAmount =
    body.order?.total_amount_without_shipping_fee ??
    body.order?.total_amount ??
    body.order_amount ??
    0;

  const { shipping_options } = buildShippingOptions({
    shipping_address: recipient,
    purchase_country: country,
    order_amount: orderAmount,
  });

  return NextResponse.json({ shipping_options });
}
