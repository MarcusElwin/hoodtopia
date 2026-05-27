import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearer } from "@/lib/kustom/shipping-auth";
import { getShipment, updateShipment } from "@/lib/kustom/shipment-store";
import type { KsaShippingOption } from "@/lib/kustom/types";

export const dynamic = "force-dynamic";

// GET /shipment/{id}  — read a previously-created shipment
// PUT /shipment/{id}  — replace the selected option (re-finalize after failure)

const updateSchema = z.object({
  selected_shipping_option: z
    .object({
      id: z.string(),
      type: z.string(),
      carrier: z.string(),
      name: z.string(),
      price: z.number(),
      tax_rate: z.number(),
    })
    .passthrough(),
});

interface RouteContext {
  params: Promise<{ shipmentId: string }>;
}

export async function GET(request: Request, ctx: RouteContext) {
  const auth = await verifyBearer(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { shipmentId } = await ctx.params;
  const shipment = getShipment(shipmentId);
  if (!shipment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    shipment_id: shipment.id,
    session_id: shipment.session_id,
    selected_shipping_option: shipment.selected_shipping_option,
    shipments: shipment.shipments,
  });
}

export async function PUT(request: Request, ctx: RouteContext) {
  const auth = await verifyBearer(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { shipmentId } = await ctx.params;

  let body;
  try {
    body = updateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const updated = updateShipment(
    shipmentId,
    body.selected_shipping_option as KsaShippingOption
  );
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    shipment_id: updated.id,
    selected_shipping_option: {
      carrier: updated.selected_shipping_option.carrier,
      carrier_product: {
        name: updated.selected_shipping_option.name,
        identifier: updated.selected_shipping_option.id,
      },
    },
    shipments: updated.shipments,
  });
}
