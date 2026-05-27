import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearer } from "@/lib/kustom/shipping-auth";
import { createShipment } from "@/lib/kustom/shipment-store";
import type { KsaShippingOption } from "@/lib/kustom/types";

export const dynamic = "force-dynamic";

// POST /shipment — Kustom finalizes the selected shipping option. We
// pre-reserve a shipment_id and respond 201 Created with the Location
// header pointing at GET /shipment/{id}. Subsequent retry attempts come
// in as PUT /shipment/{id} (see [shipmentId]/route.ts).

const optionSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    carrier: z.string(),
    name: z.string(),
    price: z.number(),
    tax_rate: z.number(),
  })
  .passthrough();

const requestSchema = z.object({
  session_id: z.string(),
  selected_shipping_option: optionSchema,
});

function baseUrl(req: Request): string {
  // Prefer the public site URL so the Location header matches what Kustom
  // will GET. Fall back to the request's own origin.
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  return new URL(req.url).origin;
}

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

  const shipment = createShipment(
    body.session_id,
    body.selected_shipping_option as KsaShippingOption
  );

  const location = `${baseUrl(request)}/api/kustom/shipping/shipment/${shipment.id}`;

  return NextResponse.json(
    {
      shipment_id: shipment.id,
      selected_shipping_option: {
        carrier: shipment.selected_shipping_option.carrier,
        carrier_product: {
          name: shipment.selected_shipping_option.name,
          identifier: shipment.selected_shipping_option.id,
        },
      },
      shipments: shipment.shipments,
    },
    {
      status: 201,
      headers: { Location: location },
    }
  );
}
