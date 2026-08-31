import { parcelTickMs } from "../config";

/**
 * Shared demo state for the three agents: orders, shipments and claims.
 *
 * Each agent reads and writes only its own slice — the checkout agent never
 * touches a shipment record, the claims agent never touches an order record.
 * Everything they need from each other travels over A2A. That constraint is
 * artificial for a single process, and it is the whole point: it forces the
 * demo to actually exercise the protocol rather than quietly sharing a table.
 */

export interface OrderLine {
  sku: string;
  name: string;
  quantity: number;
  unitMinor: number;
  lineMinor: number;
}

export interface DemoAddress {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface DemoOrder {
  id: string;
  contextId: string;
  createdAt: number;
  currency: string;
  market: string;
  lines: OrderLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  address: DemoAddress;
  shipping: {
    optionId: string;
    carrier: string;
    name: string;
    priceMinor: number;
    etaDays: { earliest: number; latest: number };
  };
  status: "placed" | "shipped" | "delivered" | "refunded" | "replaced";
}

export type ShipmentStage =
  | "label_created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered";

/** The scripted journey every fixture parcel takes, in order. */
export const SHIPMENT_STAGES: ShipmentStage[] = [
  "label_created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

export const STAGE_LABELS: Record<ShipmentStage, string> = {
  label_created: "Label created",
  picked_up: "Picked up by carrier",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

/** What the carrier records at the door. */
export const DELIVERY_NOTE = "Handed to recipient at the door";

export interface DemoShipment {
  trackingId: string;
  orderId: string;
  carrier: string;
  service: string;
  createdAt: number;
  /** Where the parcel ended up, recorded at delivery. */
  deliveredTo?: string;
  /**
   * Forces a stage regardless of the clock. Used by the "parcel is lost"
   * variant of the demo, where tracking never reaches `delivered`.
   */
  stuckAt?: ShipmentStage;
}

export interface ClaimEvidence {
  filename: string;
  mediaType: string;
  bytes: number;
}

export interface DemoClaim {
  id: string;
  contextId: string;
  orderId: string;
  createdAt: number;
  reason: string;
  evidence: ClaimEvidence[];
  status: "awaiting-evidence" | "investigating" | "resolved";
  resolution?: {
    outcome: "refund" | "replacement" | "reject" | "escalate";
    rationale: string;
    /** Which agent supplied each fact the decision rests on. */
    evidenceUsed: string[];
    refundMinor?: number;
    replacementOrderId?: string;
  };
}

interface DemoState {
  orders: Map<string, DemoOrder>;
  shipments: Map<string, DemoShipment>;
  claims: Map<string, DemoClaim>;
  counters: { order: number; claim: number };
}

const globalForState = globalThis as typeof globalThis & {
  __hoodtopiaA2AState?: DemoState;
};

export const demoState: DemoState =
  globalForState.__hoodtopiaA2AState ?? {
    orders: new Map(),
    shipments: new Map(),
    claims: new Map(),
    counters: { order: 0, claim: 0 },
  };

if (!globalForState.__hoodtopiaA2AState) {
  globalForState.__hoodtopiaA2AState = demoState;
}

/**
 * Caps on the demo's own records.
 *
 * Nothing resets this state between visitors any more — a shared reset let one
 * visitor delete another's order mid-run. Records are keyed by unique ids so
 * they coexist safely; they just need a ceiling, oldest evicted first.
 */
const MAX_RECORDS = 200;

function evict(map: Map<string, unknown>): void {
  while (map.size > MAX_RECORDS) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

export function nextOrderId(): string {
  evict(demoState.orders);
  evict(demoState.shipments);
  return `HT-${10_000 + ++demoState.counters.order}`;
}

export function nextClaimId(): string {
  evict(demoState.claims);
  return `CLM-${2_000 + ++demoState.counters.claim}`;
}

/**
 * Stage the parcel has reached at `now`, from elapsed time alone.
 *
 * Keeping this a pure function of `(shipment, now)` rather than a timer means
 * tracking is correct even if nobody was watching while the parcel moved — a
 * client that resubscribes hours later sees the right state, which is exactly
 * what a long-running A2A task has to guarantee.
 */
export function stageAt(shipment: DemoShipment, now = Date.now()): ShipmentStage {
  if (shipment.stuckAt) return shipment.stuckAt;
  const elapsed = now - shipment.createdAt;
  const index = Math.min(
    SHIPMENT_STAGES.length - 1,
    Math.floor(elapsed / parcelTickMs())
  );
  return SHIPMENT_STAGES[index]!;
}

/** Scan history up to the current stage, as a carrier would report it. */
export function scanHistory(
  shipment: DemoShipment,
  now = Date.now()
): Array<{ stage: ShipmentStage; label: string; at: string }> {
  const current = stageAt(shipment, now);
  const upto = SHIPMENT_STAGES.indexOf(current);
  return SHIPMENT_STAGES.slice(0, upto + 1).map((stage, i) => ({
    stage,
    label: STAGE_LABELS[stage],
    at: new Date(shipment.createdAt + i * parcelTickMs()).toISOString(),
  }));
}

export function isDelivered(shipment: DemoShipment, now = Date.now()): boolean {
  return stageAt(shipment, now) === "delivered";
}

/** Clears all demo state. Used by tests and the UI's "reset" control. */
export function resetDemoState(): void {
  demoState.orders.clear();
  demoState.shipments.clear();
  demoState.claims.clear();
  demoState.counters.order = 0;
  demoState.counters.claim = 0;
}
