import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearer } from "@/lib/kustom/shipping-auth";
import { buildShippingOptions } from "@/lib/kustom/shipping-options";

// Force runtime execution — these routes hit the DB / Kustom API; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

const addressSchema = z
  .object({
    given_name: z.string().optional(),
    family_name: z.string().optional(),
    email: z.string().optional(),
    street_address: z.string().optional(),
    postal_code: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
  })
  .partial();

const bodySchema = z
  .object({
    purchase_country: z.string().optional(),
    purchase_currency: z.string().optional(),
    locale: z.string().optional(),
    billing_address: addressSchema.optional(),
    shipping_address: addressSchema.optional(),
    order_amount: z.number().optional(),
    order_lines: z.array(z.any()).optional(),
  })
  .partial();

export async function POST(request: Request) {
  const ok = await verifyBearer(request.headers.get("authorization"));
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { shipping_options, preview } = buildShippingOptions({
    shipping_address: body.shipping_address,
    billing_address: body.billing_address,
    purchase_country: body.purchase_country,
    order_amount: body.order_amount,
  });

  return NextResponse.json({ shipping_options, preview });
}
