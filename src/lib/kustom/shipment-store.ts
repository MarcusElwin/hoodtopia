import "server-only";
import { randomBytes, randomUUID } from "crypto";
import type { KsaShippingOption } from "./types";
import { MARKETS } from "./markets";

// Build a tracking-id from the matching carrier's format string. Falls back
// to a generic HT-prefix if the carrier isn't in any market config (e.g.
// somebody manually POSTed a custom option to /shipment).
function trackingIdFor(carrierSlug: string): string {
  const rand = randomBytes(6).toString("hex").toUpperCase(); // 12 hex chars
  for (const market of Object.values(MARKETS)) {
    for (const c of [
      market.carriers.standard,
      market.carriers.express,
      market.carriers.pickup,
    ]) {
      if (c.carrier === carrierSlug) {
        return c.tracking_format.replace("{RAND12}", rand);
      }
    }
  }
  return `HT-${rand}`;
}

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
    // Demo: hand back a tracking number that matches the carrier's real
    // format (PostNord 13-digit, Royal Mail XX...GB, UPS 1Z...) so the demo
    // looks indistinguishable from a real integration even though we never
    // called the carrier API.
    shipments: [
      {
        carrier: option.carrier,
        tracking_id: trackingIdFor(option.carrier),
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
      tracking_id: trackingIdFor(option.carrier),
    },
  ];
  existing.updatedAt = Date.now();
  return existing;
}
