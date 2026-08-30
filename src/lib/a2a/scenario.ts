import { randomUUID } from "node:crypto";
import { TaskState } from "@a2a-js/sdk";
import type { Message, Task } from "@a2a-js/sdk";
import { callAgent, streamAgent } from "./client";
import { fileBytesPart, firstData } from "./parts";
import { demoState, type DemoAddress } from "./fixtures/store";
import { traceBus } from "./trace";
import { SCENARIO_COMPLETE } from "./markers";

/**
 * The buyer's side of the demo — a scripted shopper agent.
 *
 * It is a plain A2A client. It holds no credentials the merchant issued, has no
 * database access, and knows nothing about the three agents beyond what their
 * cards advertise. Everything it achieves, it achieves by sending messages.
 *
 * The script is deliberately not model-driven: the point on display is the
 * protocol choreography, and a fixed script makes the timeline reproducible
 * between runs (and screenshotable for a blog post).
 */

export type ScenarioId = "damaged-on-arrival" | "never-arrived";

export interface ScenarioSummary {
  id: ScenarioId;
  title: string;
  description: string;
}

export const SCENARIOS: ScenarioSummary[] = [
  {
    id: "damaged-on-arrival",
    title: "Damaged on arrival",
    description:
      "Buy, follow the parcel to the door, then claim damage with a photo. The claims agent gathers evidence from both peers and approves a replacement, which the checkout agent creates.",
  },
  {
    id: "never-arrived",
    title: "Never arrived",
    description:
      "The same purchase, but the parcel stops moving. The buyer claims non-delivery, and the identical policy reaches a refund instead — because the evidence differs, not the rules.",
  },
];

const ADDRESS: DemoAddress = {
  name: "Demo Shopper",
  street: "Drottninggatan 71",
  postalCode: "11136",
  city: "Stockholm",
  country: "SE",
};

/** A 1×1 PNG standing in for the buyer's photo of the damage. */
const DAMAGE_PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function taskOf(result: Message | Task): Task | undefined {
  return "status" in result ? result : undefined;
}

function dataOf<T>(result: Message | Task): T | undefined {
  return "status" in result
    ? firstData<T>(result.status?.message?.parts)
    : firstData<T>(result.parts);
}

function note(contextId: string, summary: string): void {
  traceBus.record({
    contextId,
    kind: "status",
    from: "shopper",
    to: "shopper",
    summary,
  });
}

interface Confirmation {
  orderId: string;
  trackingId?: string;
}

async function buyAHoodie(contextId: string): Promise<Confirmation | undefined> {
  note(contextId, "Shopper agent: buying one Nebula Fade hoodie.");

  const quoted = await callAgent({
    from: "shopper",
    to: "checkout",
    skill: "place_order",
    contextId,
    text: "Buy one Nebula Fade hoodie in L, shipped to Stockholm.",
    data: {
      items: [{ sku: "HT-NEBULA-PUR-L", quantity: 1 }],
      country: "SE",
      address: ADDRESS,
    },
  });

  const task = taskOf(quoted);
  if (task?.status?.state !== TaskState.TASK_STATE_INPUT_REQUIRED) {
    note(contextId, "Checkout did not ask for confirmation; stopping.");
    return undefined;
  }

  // The confirmation gate. In a real deployment this is where a payment
  // mandate would be presented and signed — A2A models the pause, not the
  // authorisation.
  note(contextId, "Shopper agent: total accepted, confirming the order.");
  const placed = await callAgent({
    from: "shopper",
    to: "checkout",
    contextId,
    taskId: task.id,
    text: "Confirmed, place the order.",
    data: { confirm: true },
  });

  return dataOf<Confirmation>(placed);
}

async function followTheParcel(
  contextId: string,
  trackingId: string
): Promise<void> {
  note(contextId, "Shopper agent: watching the parcel until it is delivered.");

  // A long-running task: the stream stays open across every carrier scan and
  // closes only when the shipping agent reaches a terminal state.
  for await (const frame of streamAgent({
    from: "shopper",
    to: "shipping",
    skill: "track_shipment",
    contextId,
    text: `Track ${trackingId} until it arrives.`,
    data: { trackingId },
  })) {
    const payload = frame.payload;
    if (payload?.$case === "statusUpdate") {
      const state = payload.value.status?.state;
      if (
        state === TaskState.TASK_STATE_COMPLETED ||
        state === TaskState.TASK_STATE_FAILED ||
        state === TaskState.TASK_STATE_CANCELED
      ) {
        return;
      }
    }
  }
}

async function claim(
  contextId: string,
  orderId: string,
  reason: string,
  withPhoto: boolean
): Promise<void> {
  note(contextId, "Shopper agent: opening a claim.");

  const opened = await callAgent({
    from: "shopper",
    to: "disputes",
    skill: "open_claim",
    contextId,
    text: reason,
    data: { orderId },
  });

  const task = taskOf(opened);
  if (task?.status?.state !== TaskState.TASK_STATE_INPUT_REQUIRED) return;
  if (!withPhoto) return;

  note(contextId, "Shopper agent: attaching a photo of the damage.");
  await callAgent({
    from: "shopper",
    to: "disputes",
    contextId,
    taskId: task.id,
    text: "Here is a photo of how it arrived.",
    parts: [fileBytesPart(DAMAGE_PHOTO, "image/png", "damage.png")],
  });
}

/**
 * Runs a scenario end to end. Every hop it makes lands on the trace bus under
 * `contextId`, which is what the `/agents` timeline renders.
 */
export async function runScenario(
  id: ScenarioId,
  contextId: string = randomUUID()
): Promise<string> {
  try {
    await runSteps(id, contextId);
  } finally {
    // The console watches for this rather than guessing from the last event —
    // a claim can end on a rejection with no artifact at all.
    note(contextId, SCENARIO_COMPLETE);
  }
  return contextId;
}

async function runSteps(id: ScenarioId, contextId: string): Promise<void> {
  const confirmation = await buyAHoodie(contextId);
  if (!confirmation?.orderId) return;

  if (id === "never-arrived") {
    // Demo stage-dressing, not agent behaviour: pin the parcel so the carrier
    // never records a delivery. Without it the scripted clock would deliver it
    // within seconds and the scenario would have nothing to claim about.
    if (confirmation.trackingId) {
      const shipment = demoState.shipments.get(confirmation.trackingId);
      if (shipment) shipment.stuckAt = "in_transit";
    }
    note(contextId, "The parcel stops being scanned in transit.");

    await claim(
      contextId,
      confirmation.orderId,
      `Order ${confirmation.orderId} never arrived — it has been stuck in transit for days.`,
      false
    );
    return;
  }

  if (confirmation.trackingId) {
    await followTheParcel(contextId, confirmation.trackingId);
  }

  await claim(
    contextId,
    confirmation.orderId,
    `My hoodie from ${confirmation.orderId} arrived soaked and the print is peeling off.`,
    true
  );
}
