import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDemoState,
  scanHistory,
  stageAt,
  SHIPMENT_STAGES,
  type DemoShipment,
} from "./store";

const TICK = 1_500;

function shipment(overrides: Partial<DemoShipment> = {}): DemoShipment {
  return {
    trackingId: "TRK1",
    orderId: "HT-10001",
    carrier: "postnord",
    service: "PostNord Standard",
    createdAt: 0,
    ...overrides,
  };
}

describe("parcel clock", () => {
  beforeEach(() => {
    process.env.A2A_PARCEL_TICK_MS = String(TICK);
    resetDemoState();
  });

  it("derives the stage from elapsed time, not from a timer", () => {
    const parcel = shipment();
    expect(stageAt(parcel, 0)).toBe("label_created");
    expect(stageAt(parcel, TICK)).toBe("picked_up");
    expect(stageAt(parcel, 2 * TICK)).toBe("in_transit");
    expect(stageAt(parcel, 3 * TICK)).toBe("out_for_delivery");
    expect(stageAt(parcel, 4 * TICK)).toBe("delivered");
  });

  it("stays delivered once it arrives, however long nobody was watching", () => {
    expect(stageAt(shipment(), 400 * TICK)).toBe("delivered");
  });

  it("honours a pinned stage for the lost-parcel scenario", () => {
    const stuck = shipment({ stuckAt: "in_transit" });
    expect(stageAt(stuck, 100 * TICK)).toBe("in_transit");
  });

  it("reports scan history up to the current stage only", () => {
    const history = scanHistory(shipment(), 2 * TICK);
    expect(history.map((h) => h.stage)).toEqual(
      SHIPMENT_STAGES.slice(0, 3)
    );
    expect(history.at(-1)?.label).toBe("In transit");
  });
});
