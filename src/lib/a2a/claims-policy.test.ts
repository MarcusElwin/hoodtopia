import { describe, expect, it } from "vitest";
import {
  adjudicate,
  classifyClaim,
  CLAIM_WINDOW_DAYS,
  type ClaimFacts,
} from "./claims-policy";

const DELIVERED: ClaimFacts = {
  orderFound: true,
  orderStatus: "shipped",
  totalMinor: 109900,
  currency: "SEK",
  placedAt: new Date().toISOString(),
  shipmentFound: true,
  delivered: true,
  deliveredTo: "Handed to recipient at the door",
  lastScanLabel: "Delivered",
  evidenceCount: 1,
};

const IN_TRANSIT: ClaimFacts = {
  ...DELIVERED,
  delivered: false,
  deliveredTo: undefined,
  lastScanLabel: "In transit",
  evidenceCount: 0,
};

describe("classifyClaim", () => {
  it.each([
    ["arrived soaked and the print is peeling", "damaged"],
    ["my parcel never arrived", "not_received"],
    ["you sent the wrong colour", "wrong_item"],
    ["I would like to change my address", "other"],
  ])("classifies %j as %s", (text, expected) => {
    expect(classifyClaim(text)).toBe(expected);
  });
});

describe("adjudicate", () => {
  it("replaces a delivered parcel with photographic evidence of damage", () => {
    const decision = adjudicate("damaged", DELIVERED);
    expect(decision.outcome).toBe("replacement");
    expect(decision.evidenceUsed).toEqual([
      "checkout-agent: order_status",
      "shipping-agent: shipment_evidence",
    ]);
  });

  it("refuses a damage claim with no photo rather than deciding blind", () => {
    expect(
      adjudicate("damaged", { ...DELIVERED, evidenceCount: 0 }).outcome
    ).toBe("escalate");
  });

  it("escalates damage claimed on a parcel that was never delivered", () => {
    expect(adjudicate("damaged", { ...IN_TRANSIT, evidenceCount: 2 }).outcome).toBe(
      "escalate"
    );
  });

  it("refunds non-delivery when the carrier recorded no delivery", () => {
    const decision = adjudicate("not_received", IN_TRANSIT);
    expect(decision.outcome).toBe("refund");
    expect(decision.refundMinor).toBe(109900);
  });

  it("rejects non-delivery when proof of delivery exists", () => {
    const decision = adjudicate("not_received", { ...DELIVERED, evidenceCount: 0 });
    expect(decision.outcome).toBe("reject");
    expect(decision.rationale).toContain("Handed to recipient at the door");
  });

  it("refunds when no shipment was ever booked", () => {
    const decision = adjudicate("not_received", {
      ...IN_TRANSIT,
      shipmentFound: false,
      lastScanLabel: undefined,
    });
    expect(decision.outcome).toBe("refund");
    expect(decision.rationale).toContain("never had a chance to receive it");
  });

  it("rejects a claim against an order that does not exist", () => {
    expect(
      adjudicate("damaged", { ...DELIVERED, orderFound: false }).outcome
    ).toBe("reject");
  });

  it("rejects a claim opened after the window closes", () => {
    const stale = {
      ...DELIVERED,
      placedAt: new Date(
        Date.now() - (CLAIM_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
    expect(adjudicate("damaged", stale).outcome).toBe("reject");
  });

  it("never decides an uncategorised claim on its own", () => {
    expect(adjudicate("other", DELIVERED).outcome).toBe("escalate");
  });
});
