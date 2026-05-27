import "server-only";
import { randomUUID } from "crypto";
import type { KsaShippingOption } from "./types";

// Pre-reserved shipments for KSA flow:
//   POST /shipment      → create + return shipment_id
//   GET  /shipment/{id} → read (used by Kustom's test client)
//   PUT  /shipment/{id} → update on re-finalize attempt
//
// In-memory Map is enough for the live demo and Kustom's test client. A real
// integrator would persist to Postgres / Redis with a TTL. Vercel functions
// can recycle instances so a customer's shipment may not survive across two
// requests — acceptable here because the test client runs synchronously and
// real users complete checkout in one session.

export interface StoredShipment {
  id: string;
  session_id: string;
  selected_shipping_option: KsaShippingOption;
  shipments: Array<{ carrier: string; tracking_id: string }>;
  createdAt: number;
  updatedAt: number;
}

const store = new Map<string, StoredShipment>();

export function createShipment(
  sessionId: string,
  option: KsaShippingOption
): StoredShipment {
  const id = randomUUID();
  const now = Date.now();
  const record: StoredShipment = {
    id,
    session_id: sessionId,
    selected_shipping_option: option,
    // Demo: hand back a fake tracking number so the carrier field round-trips.
    shipments: [
      {
        carrier: option.carrier,
        tracking_id: `HT-${id.slice(0, 8).toUpperCase()}`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  store.set(id, record);
  return record;
}

export function getShipment(id: string): StoredShipment | undefined {
  return store.get(id);
}

export function updateShipment(
  id: string,
  option: KsaShippingOption
): StoredShipment | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  existing.selected_shipping_option = option;
  existing.shipments = [
    {
      carrier: option.carrier,
      tracking_id: `HT-${id.slice(0, 8).toUpperCase()}`,
    },
  ];
  existing.updatedAt = Date.now();
  return existing;
}
