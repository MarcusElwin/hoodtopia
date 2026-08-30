import type { Message, Task } from "@a2a-js/sdk";
import { TaskState } from "@a2a-js/sdk";
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from "@a2a-js/sdk/server";
import { AgentEvent } from "@a2a-js/sdk/server";
import { buildShippingOptions } from "@/lib/kustom/shipping-options";
import { createShipment } from "@/lib/kustom/shipment-store";
import { getMarket } from "@/lib/kustom/markets";
import type { KsaShippingOption } from "@/lib/kustom/types";
import { buildAgentCard, skill } from "../cards";
import { parcelTickMs } from "../config";
import { requestData, resolveSkill, type SkillRoute } from "../dispatch";
import { agentMessage, artifact, dataPart, textPart } from "../parts";
import type { AgentDefinition } from "../runtime";
import { ContextIndex, newTask, statusUpdate } from "../status";
import {
  demoState,
  DELIVERY_NOTE,
  isDelivered,
  scanHistory,
  stageAt,
  STAGE_LABELS,
  SHIPMENT_STAGES,
  type DemoShipment,
} from "../fixtures/store";

/**
 * Shipping agent.
 *
 * Almost all of its commerce logic already existed: `buildShippingOptions` is
 * the function that serves Kustom's Shipping Assistant callback in the live
 * storefront, and `createShipment` is what mints carrier-shaped tracking ids.
 * The agent is a protocol skin over code that was already in production use —
 * which is the realistic way agents arrive in a commerce stack.
 *
 * The interesting part is `track_shipment`: a task that stays `working` for the
 * life of a delivery. A tool call cannot model that. An A2A task can.
 */

/** How long a cancel flag stays readable by a running tracking loop. */
const CANCEL_FLAG_TTL_MS = 60_000;

const ROUTES: SkillRoute[] = [
  { id: "quote_shipping", keywords: ["quote", "rate", "options", "how much", "delivery cost"] },
  { id: "book_shipment", keywords: ["book", "label", "dispatch", "ship it"] },
  { id: "track_shipment", keywords: ["track", "where", "status", "parcel", "arrived"] },
  { id: "shipment_evidence", keywords: ["evidence", "proof of delivery", "scan history"] },
];

export const shippingCard = buildAgentCard({
  id: "shipping",
  name: "Hoodtopia Shipping Agent",
  description:
    "Quotes carrier options for a destination and basket value, books shipments, and tracks a parcel from label to doorstep. Tracking is a long-running task: it stays open until the parcel is delivered.",
  version: "1.0.0",
  pushNotifications: true,
  documentationUrl:
    "https://github.com/MarcusElwin/hoodtopia/blob/main/docs/A2A_INTEGRATION.md",
  skills: [
    skill({
      id: "quote_shipping",
      name: "Quote shipping options",
      description:
        "Returns available carriers, prices in the destination market's currency, and delivery windows for a destination country and basket value. Free standard shipping is applied above the market threshold.",
      tags: ["shipping", "rates", "carriers"],
      examples: [
        "What are the delivery options to Sweden for a 1,099 SEK basket?",
        "Quote shipping to postcode 11136, Stockholm.",
      ],
    }),
    skill({
      id: "book_shipment",
      name: "Book a shipment",
      description:
        "Reserves a shipment with the chosen carrier and returns a tracking id in that carrier's real-world format.",
      tags: ["shipping", "fulfilment", "labels"],
      examples: ["Book express delivery for order HT-10001."],
    }),
    skill({
      id: "track_shipment",
      name: "Track a shipment",
      description:
        "Follows a parcel until it is delivered. Runs as a long-running task that emits a status update at every carrier scan and completes with a proof-of-delivery artifact. Register a push notification config to be called back instead of holding the stream open.",
      tags: ["shipping", "tracking", "long-running"],
      examples: ["Where is parcel 00370123456789012345?"],
      outputModes: ["application/json", "text/plain"],
    }),
    skill({
      id: "shipment_evidence",
      name: "Retrieve delivery evidence",
      description:
        "Returns the full scan history and proof of delivery for an order's shipment. Used by claims handling to establish whether, when and to whom a parcel was actually delivered.",
      tags: ["shipping", "evidence", "claims"],
      examples: ["What is the delivery evidence for order HT-10001?"],
    }),
  ],
});

interface QuoteArgs {
  country?: string;
  orderAmountMinor?: number;
  address?: { postalCode?: string; city?: string; country?: string };
}

interface BookArgs {
  orderId: string;
  optionId?: string;
  country?: string;
  address?: { postalCode?: string; city?: string; country?: string };
}

interface TrackArgs {
  trackingId: string;
}

function quoteOptions(args: QuoteArgs) {
  const country = (args.address?.country ?? args.country ?? "SE").toUpperCase();
  const market = getMarket(country);
  const { shipping_options } = buildShippingOptions({
    shipping_address: args.address?.postalCode
      ? {
          postal_code: args.address.postalCode,
          city: args.address.city,
          country,
        }
      : undefined,
    purchase_country: country,
    order_amount: args.orderAmountMinor ?? 0,
  });

  return {
    country,
    currency: market.purchase_currency,
    options: shipping_options.map((o) => ({
      id: o.id,
      carrier: o.carrier,
      name: o.name,
      description: o.description,
      priceMinor: o.price,
      taxRateBp: o.tax_rate,
      etaDays: {
        earliest: o.delivery_time?.interval?.earliest ?? 3,
        latest: o.delivery_time?.interval?.latest ?? 5,
      },
      pickupLocations: o.locations?.length ?? 0,
    })),
  };
}

function toKsaOption(
  quoted: ReturnType<typeof quoteOptions>,
  optionId: string | undefined
): KsaShippingOption | undefined {
  const chosen =
    quoted.options.find((o) => o.id === optionId) ?? quoted.options[0];
  if (!chosen) return undefined;
  return {
    id: chosen.id,
    type: chosen.id === "pup" ? "pickup-point" : "delivery-address",
    carrier: chosen.carrier,
    name: chosen.name,
    description: chosen.description,
    price: chosen.priceMinor,
    tax_rate: chosen.taxRateBp,
  };
}

class ShippingExecutor implements AgentExecutor {
  private readonly canceled = new Set<string>();

  async execute(
    ctx: RequestContext,
    bus: ExecutionEventBus
  ): Promise<void> {
    const task: Task =
      ctx.task ??
      newTask({
        id: ctx.taskId,
        contextId: ctx.contextId,
        history: [ctx.userMessage],
      });
    this.contexts.remember(task.id, task.contextId);
    bus.publish(AgentEvent.task(task));

    const chosen = resolveSkill(ctx, ROUTES, "quote_shipping");

    try {
      switch (chosen) {
        case "book_shipment":
          await this.book(ctx, bus, task);
          break;
        case "track_shipment":
          await this.track(ctx, bus, task);
          break;
        case "shipment_evidence":
          await this.evidence(ctx, bus, task);
          break;
        default:
          await this.quote(ctx, bus, task);
      }
    } catch (error) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_FAILED,
            message: this.say(
              task,
              error instanceof Error ? error.message : "Shipping failed"
            ),
          })
        )
      );
    } finally {
      bus.finished();
    }
  }

  private readonly contexts = new ContextIndex();

  async cancelTask(taskId: string, bus: ExecutionEventBus): Promise<void> {
    // Tracking loops check this between scans so a cancel takes effect at the
    // next tick rather than being ignored for the life of the delivery.
    this.canceled.add(taskId);
    // Only the tracking loop consumes this flag, and only if it is still
    // running. Drop it on a timer so a cancel for any other skill — or for a
    // tracking task that already finished — cannot accumulate.
    setTimeout(() => this.canceled.delete(taskId), CANCEL_FLAG_TTL_MS).unref?.();
    this.contexts.forget(taskId);
    bus.publish(
      AgentEvent.statusUpdate({
        taskId,
        contextId: this.contexts.contextFor(taskId),
        status: {
          state: TaskState.TASK_STATE_CANCELED,
          message: undefined,
          timestamp: new Date().toISOString(),
        },
        metadata: undefined,
      })
    );
  }

  private say(task: Task, text: string, data?: unknown): Message {
    return agentMessage({
      contextId: task.contextId,
      taskId: task.id,
      parts: data === undefined
        ? [textPart(text)]
        : [textPart(text), dataPart(data)],
    });
  }

  private working(task: Task, bus: ExecutionEventBus, text: string): void {
    bus.publish(
      AgentEvent.statusUpdate(
        statusUpdate({
          taskId: task.id,
          contextId: task.contextId,
          state: TaskState.TASK_STATE_WORKING,
          message: this.say(task, text),
        })
      )
    );
  }

  private complete(
    task: Task,
    bus: ExecutionEventBus,
    text: string,
    data?: unknown
  ): void {
    bus.publish(
      AgentEvent.statusUpdate(
        statusUpdate({
          taskId: task.id,
          contextId: task.contextId,
          state: TaskState.TASK_STATE_COMPLETED,
          message: this.say(task, text, data),
        })
      )
    );
  }

  private async quote(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<QuoteArgs>(ctx) ?? {};
    this.working(task, bus, "Looking up carriers for that destination…");

    const quoted = quoteOptions(args);
    const cheapest = [...quoted.options].sort(
      (a, b) => a.priceMinor - b.priceMinor
    )[0];

    this.complete(
      task,
      bus,
      `${quoted.options.length} options to ${quoted.country}, from ${
        cheapest ? cheapest.name : "n/a"
      }.`,
      quoted
    );
  }

  private async book(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<BookArgs>(ctx);
    if (!args?.orderId) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_INPUT_REQUIRED,
            message: this.say(task, "Which order should I book a shipment for?"),
          })
        )
      );
      return;
    }

    this.working(task, bus, `Booking a shipment for ${args.orderId}…`);

    const quoted = quoteOptions({
      country: args.country,
      address: args.address,
    });
    const option = toKsaOption(quoted, args.optionId);
    if (!option) {
      throw new Error(`No shipping option available for ${quoted.country}`);
    }

    // Reuses the storefront's own shipment reservation, so the tracking id
    // matches the carrier's real format (PostNord 13-digit, Royal Mail
    // XX…GB, UPS 1Z…) rather than looking like a demo placeholder.
    const reserved = createShipment(task.contextId, option);
    const trackingId = reserved.shipments[0]!.tracking_id;
    const quotedOption = quoted.options.find((o) => o.id === option.id);

    const shipment: DemoShipment = {
      trackingId,
      orderId: args.orderId,
      carrier: option.carrier,
      service: option.name,
      createdAt: Date.now(),
    };
    demoState.shipments.set(trackingId, shipment);

    const payload = {
      trackingId,
      orderId: args.orderId,
      carrier: option.carrier,
      service: option.name,
      priceMinor: option.price,
      currency: quoted.currency,
      etaDays: quotedOption?.etaDays ?? { earliest: 3, latest: 5 },
    };

    bus.publish(
      AgentEvent.artifactUpdate({
        taskId: task.id,
        contextId: task.contextId,
        artifact: artifact({
          name: "shipping-label",
          description: `Shipment booked with ${option.carrier}`,
          parts: [dataPart(payload)],
        }),
        append: false,
        lastChunk: true,
        metadata: undefined,
      })
    );

    this.complete(
      task,
      bus,
      `Booked ${option.name}. Tracking id ${trackingId}.`,
      payload
    );
  }

  /**
   * Delivery evidence for an order, served to whoever asks over A2A. The claims
   * agent is just another caller here: it has no privileged read into shipping
   * state, which is what makes the mesh a real one.
   */
  private async evidence(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<{ orderId?: string }>(ctx);
    if (!args?.orderId) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_INPUT_REQUIRED,
            message: this.say(task, "Which order do you need evidence for?"),
          })
        )
      );
      return;
    }

    this.working(task, bus, `Pulling scan history for ${args.orderId}…`);

    const shipment = [...demoState.shipments.values()].find(
      (s) => s.orderId === args.orderId
    );

    if (!shipment) {
      this.complete(
        task,
        bus,
        `No shipment on record for ${args.orderId}.`,
        { orderId: args.orderId, found: false }
      );
      return;
    }

    // Delivery is a fact about the parcel, not about whether anyone happened
    // to be streaming a tracking task when it arrived — so the note is derived
    // here rather than read back from whatever `track` last wrote.
    const delivered = isDelivered(shipment);
    const payload = {
      orderId: args.orderId,
      found: true,
      trackingId: shipment.trackingId,
      carrier: shipment.carrier,
      service: shipment.service,
      delivered,
      deliveredTo: delivered
        ? (shipment.deliveredTo ?? DELIVERY_NOTE)
        : undefined,
      scans: scanHistory(shipment),
    };

    this.complete(
      task,
      bus,
      payload.delivered
        ? `Delivered via ${shipment.carrier} (${shipment.trackingId}).`
        : `In transit with ${shipment.carrier} (${shipment.trackingId}).`,
      payload
    );
  }

  /**
   * The long-running skill. The task is published immediately and then stays in
   * `working`, emitting a status update at each carrier scan, until the parcel
   * is delivered. A client can watch the stream, or register a push
   * notification config and be called back instead.
   */
  private async track(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<TrackArgs>(ctx);
    const shipment = args?.trackingId
      ? demoState.shipments.get(args.trackingId)
      : undefined;

    if (!shipment) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_INPUT_REQUIRED,
            message: this.say(
              task,
              args?.trackingId
                ? `I have no shipment with tracking id ${args.trackingId}. Can you check it?`
                : "Which tracking id should I follow?"
            ),
          })
        )
      );
      return;
    }

    let lastStage: string | undefined;

    // Poll faster than the parcel moves so no scan is missed, and wait well
    // past the nominal delivery time before concluding it is stuck — a tight
    // budget would report a healthy parcel as lost.
    const pollMs = Math.max(100, Math.round(parcelTickMs() / 3));
    const nominalMs = (SHIPMENT_STAGES.length - 1) * parcelTickMs();
    const maxPolls = Math.ceil((nominalMs * 3) / pollMs);

    for (let tick = 0; tick < maxPolls; tick++) {
      if (this.canceled.has(task.id)) {
        this.canceled.delete(task.id);
        return;
      }

      const stage = stageAt(shipment);
      if (stage !== lastStage) {
        lastStage = stage;
        const delivered = stage === "delivered";

        if (delivered) {
          shipment.deliveredTo = DELIVERY_NOTE;
          const proof = {
            trackingId: shipment.trackingId,
            orderId: shipment.orderId,
            carrier: shipment.carrier,
            deliveredAt: new Date().toISOString(),
            deliveredTo: shipment.deliveredTo,
            scans: scanHistory(shipment),
          };

          bus.publish(
            AgentEvent.artifactUpdate({
              taskId: task.id,
              contextId: task.contextId,
              artifact: artifact({
                name: "proof-of-delivery",
                description: `Delivery confirmation for ${shipment.trackingId}`,
                parts: [dataPart(proof)],
              }),
              append: false,
              lastChunk: true,
              metadata: undefined,
            })
          );

          this.complete(
            task,
            bus,
            `Delivered. ${shipment.deliveredTo}.`,
            proof
          );
          return;
        }

        this.working(task, bus, STAGE_LABELS[stage]);
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    // The parcel stopped moving. Failing the task is the honest outcome, and
    // it is what gives the claims agent something to reason about.
    bus.publish(
      AgentEvent.statusUpdate(
        statusUpdate({
          taskId: task.id,
          contextId: task.contextId,
          state: TaskState.TASK_STATE_FAILED,
          message: this.say(
            task,
            `No carrier scan since "${STAGE_LABELS[stageAt(shipment)]}". The parcel appears to be stuck.`,
            { trackingId: shipment.trackingId, scans: scanHistory(shipment) }
          ),
        })
      )
    );
  }
}

export const shippingAgent: AgentDefinition = {
  id: "shipping",
  card: shippingCard,
  executor: new ShippingExecutor(),
  pushNotifications: true,
};
