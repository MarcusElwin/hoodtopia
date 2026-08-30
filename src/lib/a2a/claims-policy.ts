/**
 * Claim adjudication.
 *
 * Kept deliberately deterministic and separate from the agent. A model is good
 * at reading "it turned up soaked and the print is peeling" and calling that a
 * damage claim; it is the wrong thing to put in charge of whether money moves.
 * So the split is: classification can be a model (see `classifyClaim`), the
 * decision is a table.
 *
 * The facts the table runs on do not come from a database this agent owns —
 * they are gathered over A2A from the checkout and shipping agents.
 */

export type ClaimType = "damaged" | "not_received" | "wrong_item" | "other";

export type ClaimOutcome = "refund" | "replacement" | "reject" | "escalate";

export interface ClaimFacts {
  orderFound: boolean;
  orderStatus?: string;
  totalMinor?: number;
  currency?: string;
  placedAt?: string;
  shipmentFound: boolean;
  delivered: boolean;
  deliveredTo?: string;
  lastScanLabel?: string;
  /** Number of evidence files the buyer attached. */
  evidenceCount: number;
}

export interface ClaimDecision {
  outcome: ClaimOutcome;
  rationale: string;
  /** Which agent supplied each fact the decision rests on. */
  evidenceUsed: string[];
  refundMinor?: number;
}

/** How long after purchase a claim is accepted. */
export const CLAIM_WINDOW_DAYS = 30;

const KEYWORDS: Array<{ type: ClaimType; words: string[] }> = [
  {
    type: "damaged",
    words: ["damag", "broken", "torn", "ripped", "stain", "soaked", "peel", "faulty", "defect"],
  },
  {
    type: "not_received",
    words: ["not receiv", "never arriv", "didn't arrive", "did not arrive", "missing", "lost", "stolen"],
  },
  {
    type: "wrong_item",
    words: ["wrong", "different", "not what i ordered", "incorrect size", "wrong colour", "wrong color"],
  },
];

/** Keyword classification. `live` mode replaces this with a model call. */
export function classifyClaim(text: string): ClaimType {
  const haystack = text.toLowerCase();
  for (const { type, words } of KEYWORDS) {
    if (words.some((w) => haystack.includes(w))) return type;
  }
  return "other";
}

function withinWindow(placedAt: string | undefined, now: number): boolean {
  if (!placedAt) return true;
  const placed = Date.parse(placedAt);
  if (Number.isNaN(placed)) return true;
  return now - placed <= CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function adjudicate(
  type: ClaimType,
  facts: ClaimFacts,
  now = Date.now()
): ClaimDecision {
  const sources: string[] = [];
  if (facts.orderFound) sources.push("checkout-agent: order_status");
  if (facts.shipmentFound) sources.push("shipping-agent: shipment_evidence");

  if (!facts.orderFound) {
    return {
      outcome: "reject",
      rationale:
        "The checkout agent has no order on record matching this claim, so there is nothing to adjudicate.",
      evidenceUsed: sources,
    };
  }

  if (!withinWindow(facts.placedAt, now)) {
    return {
      outcome: "reject",
      rationale: `The order was placed outside the ${CLAIM_WINDOW_DAYS}-day claim window.`,
      evidenceUsed: sources,
    };
  }

  switch (type) {
    case "damaged":
      if (!facts.delivered) {
        return {
          outcome: "escalate",
          rationale:
            "The buyer reports damage, but the carrier has not recorded a delivery yet. The two accounts do not line up, so this needs a human before any money moves.",
          evidenceUsed: sources,
        };
      }
      if (facts.evidenceCount === 0) {
        return {
          outcome: "escalate",
          rationale:
            "A damage claim on a delivered parcel needs photographic evidence, and none was supplied.",
          evidenceUsed: sources,
        };
      }
      return {
        outcome: "replacement",
        rationale: `The parcel was delivered (${
          facts.deliveredTo ?? "carrier confirmed"
        }) and the buyer supplied ${facts.evidenceCount} photo(s) of damage within the claim window. A replacement is cheaper than a refund and keeps the sale.`,
        evidenceUsed: sources,
      };

    case "not_received":
      if (facts.delivered) {
        return {
          outcome: "reject",
          rationale: `The shipping agent holds proof of delivery — ${
            facts.deliveredTo ?? "recorded as delivered"
          }, last scan "${facts.lastScanLabel ?? "delivered"}". The claim is refused on that evidence; the buyer can dispute it with the carrier.`,
          evidenceUsed: sources,
        };
      }
      return {
        outcome: "refund",
        rationale: facts.shipmentFound
          ? `The parcel has not been scanned past "${
              facts.lastScanLabel ?? "label created"
            }" and no delivery was recorded, so it is treated as lost in transit.`
          : "No shipment was ever booked against this order, so the buyer never had a chance to receive it.",
        evidenceUsed: sources,
        refundMinor: facts.totalMinor,
      };

    case "wrong_item":
      if (!facts.delivered) {
        return {
          outcome: "escalate",
          rationale:
            "The buyer says the wrong item arrived, but no delivery has been recorded. Needs a human to reconcile.",
          evidenceUsed: sources,
        };
      }
      return {
        outcome: "replacement",
        rationale:
          "A delivered parcel with the wrong contents is a fulfilment error; the correct item is sent at no charge.",
        evidenceUsed: sources,
      };

    default:
      return {
        outcome: "escalate",
        rationale:
          "The claim does not fall into a category this agent is authorised to decide. Routing to a human handler.",
        evidenceUsed: sources,
      };
  }
}
