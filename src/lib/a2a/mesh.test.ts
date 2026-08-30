import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskState, type Message, type Task } from "@a2a-js/sdk";
import { installMeshFetch, TEST_ORIGIN } from "./test-harness";
import { callAgent } from "./client";
import { runtimeFor } from "./agents";
import { firstData, fileBytesPart } from "./parts";
import { traceBus } from "./trace";
import { AGENT_IDS } from "./registry";

/**
 * End-to-end tests over the real JSON-RPC handlers. Agent-to-agent calls go
 * through `fetch` exactly as they do in production; only the transport
 * destination is redirected in-process (see ./test-harness.ts).
 */

let teardown: () => void;

beforeEach(() => {
  process.env.A2A_PARCEL_TICK_MS = "1";
  teardown = installMeshFetch();
});

afterEach(() => teardown());

function asTask(result: Message | Task): Task {
  if (!("status" in result)) throw new Error("Expected a Task, got a Message");
  return result;
}

function data<T>(result: Message | Task): T | undefined {
  return "status" in result
    ? firstData<T>(result.status?.message?.parts)
    : firstData<T>(result.parts);
}

const ORDER = {
  items: [{ sku: "HT-NEBULA-PUR-L", quantity: 1 }],
  country: "SE",
  address: {
    name: "Test Shopper",
    street: "Drottninggatan 71",
    postalCode: "11136",
    city: "Stockholm",
    country: "SE",
  },
};

describe("agent cards", () => {
  it.each(AGENT_IDS)("%s advertises an absolute endpoint and skills", (id) => {
    const { card } = runtimeFor(id);
    expect(card.supportedInterfaces[0]?.url).toBe(`${TEST_ORIGIN}/a2a/${id}`);
    expect(card.supportedInterfaces[0]?.protocolVersion).toBe("1.0");
    expect(card.skills.length).toBeGreaterThan(0);
    for (const skill of card.skills) {
      expect(skill.id).toMatch(/^[a-z_]+$/);
      expect(skill.description.length).toBeGreaterThan(20);
    }
  });

  it("only advertises push notifications on the long-running agent", () => {
    expect(runtimeFor("shipping").card.capabilities?.pushNotifications).toBe(true);
    expect(runtimeFor("checkout").card.capabilities?.pushNotifications).toBe(false);
  });
});

describe("checkout", () => {
  it("delegates shipping rates to the shipping agent before quoting", async () => {
    const contextId = "ctx-quote";
    await callAgent({
      from: "shopper",
      to: "checkout",
      skill: "quote_cart",
      contextId,
      data: ORDER,
    });

    const hops = traceBus
      .history(contextId)
      .filter((e) => e.kind === "request" && e.from === "checkout");

    expect(hops).toHaveLength(1);
    expect(hops[0]).toMatchObject({ to: "shipping", skill: "quote_shipping" });
  });

  it("parks in input-required rather than charging without confirmation", async () => {
    const task = asTask(
      await callAgent({
        from: "shopper",
        to: "checkout",
        skill: "place_order",
        contextId: "ctx-gate",
        data: ORDER,
      })
    );

    expect(task.status?.state).toBe(TaskState.TASK_STATE_INPUT_REQUIRED);
    expect(task.artifacts).toHaveLength(0);
    expect(data<{ totalMinor: number }>(task)?.totalMinor).toBe(109900);
  });

  it("places the order on confirmation and returns a confirmation artifact", async () => {
    const contextId = "ctx-buy";
    const pending = asTask(
      await callAgent({
        from: "shopper",
        to: "checkout",
        skill: "place_order",
        contextId,
        data: ORDER,
      })
    );

    const placed = asTask(
      await callAgent({
        from: "shopper",
        to: "checkout",
        contextId,
        taskId: pending.id,
        text: "confirm",
        data: { confirm: true },
      })
    );

    expect(placed.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
    expect(placed.artifacts.map((a) => a.name)).toContain("order-confirmation");

    const confirmation = data<{ orderId: string; trackingId?: string }>(placed);
    expect(confirmation?.orderId).toMatch(/^HT-\d+$/);
    // The tracking id is minted by the shipping agent, so its presence proves
    // the second agent-to-agent hop happened.
    expect(confirmation?.trackingId).toBeTruthy();
  });

  it("stands down when the buyer declines", async () => {
    const contextId = "ctx-decline";
    const pending = asTask(
      await callAgent({
        from: "shopper",
        to: "checkout",
        skill: "place_order",
        contextId,
        data: ORDER,
      })
    );

    const declined = asTask(
      await callAgent({
        from: "shopper",
        to: "checkout",
        contextId,
        taskId: pending.id,
        text: "no, cancel that",
      })
    );

    expect(declined.status?.state).toBe(TaskState.TASK_STATE_REJECTED);
  });
});

describe("shipping", () => {
  it("prices the destination market's carriers in its own currency", async () => {
    const quoted = await callAgent({
      from: "shopper",
      to: "shipping",
      skill: "quote_shipping",
      contextId: "ctx-rates",
      data: { country: "GB", orderAmountMinor: 1000 },
    });

    const payload = data<{
      currency: string;
      options: Array<{ carrier: string; priceMinor: number }>;
    }>(quoted);

    expect(payload?.currency).toBe("GBP");
    expect(payload?.options.length).toBeGreaterThan(1);
    expect(payload?.options.map((o) => o.carrier)).toContain("royal-mail");
  });

  it("asks for a tracking id instead of guessing", async () => {
    const task = asTask(
      await callAgent({
        from: "shopper",
        to: "shipping",
        skill: "track_shipment",
        contextId: "ctx-track",
        data: {},
      })
    );
    expect(task.status?.state).toBe(TaskState.TASK_STATE_INPUT_REQUIRED);
  });
});

describe("claims", () => {
  async function buy(contextId: string) {
    const pending = asTask(
      await callAgent({
        from: "shopper",
        to: "checkout",
        skill: "place_order",
        contextId,
        data: ORDER,
      })
    );
    const placed = await callAgent({
      from: "shopper",
      to: "checkout",
      contextId,
      taskId: pending.id,
      data: { confirm: true },
    });
    return data<{ orderId: string; trackingId?: string }>(placed)!;
  }

  it("gathers evidence from both peers before deciding", async () => {
    const contextId = "ctx-claim";
    const { orderId } = await buy(contextId);

    const opened = asTask(
      await callAgent({
        from: "shopper",
        to: "disputes",
        skill: "open_claim",
        contextId,
        text: "It arrived soaked and the print is peeling off.",
        data: { orderId },
      })
    );
    expect(opened.status?.state).toBe(TaskState.TASK_STATE_INPUT_REQUIRED);

    const resolved = asTask(
      await callAgent({
        from: "shopper",
        to: "disputes",
        contextId,
        taskId: opened.id,
        text: "Here is the photo.",
        parts: [
          fileBytesPart(Buffer.from([1, 2, 3]), "image/png", "damage.png"),
        ],
      })
    );

    expect(resolved.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);

    const outbound = traceBus
      .history(contextId)
      .filter((e) => e.kind === "request" && e.from === "disputes");

    // The claims agent has no database access to either peer, so every fact it
    // used had to arrive over the wire.
    expect(outbound.map((e) => `${e.to}:${e.skill}`)).toEqual(
      expect.arrayContaining([
        "checkout:order_status",
        "shipping:shipment_evidence",
      ])
    );
  });

  it("approves a replacement and has the checkout agent create it", async () => {
    const contextId = "ctx-replace";
    const { orderId } = await buy(contextId);

    const opened = asTask(
      await callAgent({
        from: "shopper",
        to: "disputes",
        skill: "open_claim",
        contextId,
        text: "It arrived damaged, the print is peeling.",
        data: { orderId },
      })
    );

    const resolved = asTask(
      await callAgent({
        from: "shopper",
        to: "disputes",
        contextId,
        taskId: opened.id,
        parts: [
          fileBytesPart(Buffer.from([1, 2, 3]), "image/png", "damage.png"),
        ],
      })
    );

    const resolution = data<{
      outcome: string;
      replacementOrderId?: string;
      evidenceUsed: string[];
    }>(resolved);

    expect(resolution?.outcome).toBe("replacement");
    expect(resolution?.replacementOrderId).toMatch(/^HT-\d+$/);
    expect(resolution?.replacementOrderId).not.toBe(orderId);
    expect(resolved.artifacts.map((a) => a.name)).toContain("claim-resolution");

    // ...and the replacement is a real order the checkout agent will answer for.
    const status = await callAgent({
      from: "shopper",
      to: "checkout",
      skill: "order_status",
      contextId,
      data: { orderId: resolution!.replacementOrderId },
    });
    expect(data<{ found: boolean; totalMinor: number }>(status)).toMatchObject({
      found: true,
      totalMinor: 0,
    });
  });

  it("refunds non-delivery when the carrier never recorded a delivery", async () => {
    const contextId = "ctx-lost";
    const { orderId, trackingId } = await buy(contextId);

    const { demoState } = await import("./fixtures/store");
    demoState.shipments.get(trackingId!)!.stuckAt = "in_transit";

    const resolved = asTask(
      await callAgent({
        from: "shopper",
        to: "disputes",
        skill: "open_claim",
        contextId,
        text: `Order ${orderId} never arrived.`,
        data: { orderId },
      })
    );

    expect(data<{ outcome: string }>(resolved)?.outcome).toBe("refund");
  });

  it("rejects a claim against an order no agent has heard of", async () => {
    const resolved = asTask(
      await callAgent({
        from: "shopper",
        to: "disputes",
        skill: "open_claim",
        contextId: "ctx-ghost",
        text: "Order HT-99999 never arrived.",
        data: { orderId: "HT-99999" },
      })
    );
    expect(data<{ outcome: string }>(resolved)?.outcome).toBe("reject");
  });
});

describe("JSON-RPC transport", () => {
  it("rejects an unknown method with -32601", async () => {
    const response = await runtimeFor("checkout").jsonRpc.handle(
      { jsonrpc: "2.0", id: 1, method: "NoSuchMethod", params: {} },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      undefined as any
    );
    expect(response).toMatchObject({ error: { code: -32601 } });
  });
});
