import type { Message, Task } from "@a2a-js/sdk";
import { TaskState } from "@a2a-js/sdk";
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from "@a2a-js/sdk/server";
import { AgentEvent } from "@a2a-js/sdk/server";
import { buildAgentCard, skill } from "../cards";
import { callAgent } from "../client";
import { requestData, requestText, resolveSkill, type SkillRoute } from "../dispatch";
import { agentMessage, artifact, dataPart, firstData, textPart } from "../parts";
import { formatMinor, priceCart, type RequestedLine } from "../pricing";
import type { AgentDefinition } from "../runtime";
import { newTask, statusUpdate } from "../status";
import {
  demoState,
  nextOrderId,
  type DemoAddress,
  type DemoOrder,
  type OrderLine,
} from "../fixtures/store";

/**
 * Checkout agent.
 *
 * Two things here are worth more than the rest of the file.
 *
 * First, it cannot answer a pricing question on its own: a total needs a
 * shipping cost, and shipping belongs to a different agent. So the checkout
 * agent opens an A2A call of its own to the shipping agent, mid-task. It is a
 * server to the buyer and a client to shipping, simultaneously, over the same
 * protocol — which is the property that makes A2A a mesh rather than a fancier
 * tool call.
 *
 * Second, it refuses to place an order without an explicit confirmation. The
 * task parks in `input-required` carrying the quote, and only a follow-up
 * message on the same task moves it forward. That pause is the seam where a
 * real deployment would attach a payment mandate — see the notes in
 * docs/A2A_INTEGRATION.md on what A2A deliberately does not cover.
 */

const ROUTES: SkillRoute[] = [
  { id: "quote_cart", keywords: ["quote", "how much", "price", "cost", "total"] },
  { id: "place_order", keywords: ["buy", "order", "purchase", "checkout", "place"] },
  { id: "order_status", keywords: ["status", "look up", "find order", "details"] },
  { id: "issue_replacement", keywords: ["replacement", "resend", "send another"] },
];

export const checkoutCard = buildAgentCard({
  id: "checkout",
  name: "Hoodtopia Checkout Agent",
  description:
    "Prices a basket including delivery, confirms the total with the buyer, and places the order. Delegates shipping rates to the Hoodtopia Shipping Agent rather than guessing them.",
  version: "1.0.0",
  documentationUrl:
    "https://github.com/MarcusElwin/hoodtopia/blob/main/docs/A2A_INTEGRATION.md",
  skills: [
    skill({
      id: "quote_cart",
      name: "Quote a basket",
      description:
        "Prices line items and delivery for a destination, returning a full breakdown. Does not reserve stock or take payment.",
      tags: ["commerce", "pricing", "quote"],
      examples: [
        "What would two Nebula Fade hoodies cost delivered to Stockholm?",
      ],
    }),
    skill({
      id: "place_order",
      name: "Place an order",
      description:
        "Prices the basket, then pauses in input-required with the total for explicit confirmation before committing. On confirmation it books the shipment and returns an order-confirmation artifact.",
      tags: ["commerce", "orders", "checkout"],
      examples: [
        "Buy one HT-NEBULA-PUR-L, ship to Drottninggatan 71, 11136 Stockholm.",
      ],
    }),
    skill({
      id: "order_status",
      name: "Look up an order",
      description:
        "Returns what was ordered, what was paid, when, and where it was sent. Used by buyers and by claims handling to establish the facts of a purchase.",
      tags: ["commerce", "orders", "evidence"],
      examples: ["What is the status of order HT-10001?"],
    }),
    skill({
      id: "issue_replacement",
      name: "Issue a replacement order",
      description:
        "Creates a zero-cost replacement for an existing order. Restricted to callers acting on a resolved claim.",
      tags: ["commerce", "orders", "claims"],
      examples: ["Issue a replacement for HT-10001."],
    }),
  ],
});

interface PlaceOrderArgs {
  items?: RequestedLine[];
  address?: DemoAddress;
  country?: string;
  shippingOptionId?: string;
}

interface PendingOrder {
  kind: "pending-order";
  lines: OrderLine[];
  currency: string;
  market: string;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  address: DemoAddress;
  shipping: DemoOrder["shipping"];
}

interface ShippingQuoteResult {
  country: string;
  currency: string;
  options: Array<{
    id: string;
    carrier: string;
    name: string;
    priceMinor: number;
    etaDays: { earliest: number; latest: number };
  }>;
}

const DEFAULT_ADDRESS: DemoAddress = {
  name: "Demo Shopper",
  street: "Drottninggatan 71",
  postalCode: "11136",
  city: "Stockholm",
  country: "SE",
};

/** Reads a data part out of a message, whichever message carries it. */
function pendingFrom(task: Task | undefined): PendingOrder | undefined {
  if (!task) return undefined;
  const fromStatus = firstData<PendingOrder>(task.status?.message?.parts);
  if (fromStatus?.kind === "pending-order") return fromStatus;
  for (const message of [...(task.history ?? [])].reverse()) {
    const data = firstData<PendingOrder>(message.parts);
    if (data?.kind === "pending-order") return data;
  }
  return undefined;
}

function affirmative(text: string, data: unknown): boolean {
  if (
    typeof data === "object" &&
    data !== null &&
    "confirm" in (data as Record<string, unknown>)
  ) {
    return Boolean((data as { confirm?: unknown }).confirm);
  }
  return /\b(yes|confirm|confirmed|go ahead|place it|do it|ok)\b/i.test(text);
}

class CheckoutExecutor implements AgentExecutor {
  async execute(ctx: RequestContext, bus: ExecutionEventBus): Promise<void> {
    const task: Task =
      ctx.task ??
      newTask({
        id: ctx.taskId,
        contextId: ctx.contextId,
        history: [ctx.userMessage],
      });
    bus.publish(AgentEvent.task(task));

    // A follow-up on a task that is waiting for confirmation is always an
    // answer to that question, whatever keywords the text happens to contain.
    const pending = pendingFrom(ctx.task);
    const isAnswer =
      ctx.task?.status?.state === TaskState.TASK_STATE_INPUT_REQUIRED &&
      pending !== undefined;

    try {
      if (isAnswer) {
        await this.confirm(ctx, bus, task, pending);
        return;
      }

      switch (resolveSkill(ctx, ROUTES, "quote_cart")) {
        case "place_order":
          await this.placeOrder(ctx, bus, task);
          break;
        case "order_status":
          await this.orderStatus(ctx, bus, task);
          break;
        case "issue_replacement":
          await this.issueReplacement(ctx, bus, task);
          break;
        default:
          await this.quoteCart(ctx, bus, task);
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
              error instanceof Error ? error.message : "Checkout failed"
            ),
          })
        )
      );
    } finally {
      bus.finished();
    }
  }

  async cancelTask(taskId: string, bus: ExecutionEventBus): Promise<void> {
    bus.publish(
      AgentEvent.statusUpdate({
        taskId,
        contextId: "",
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
      parts:
        data === undefined
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

  /**
   * Prices a basket. The shipping leg is an outbound A2A call — the checkout
   * agent does not own rate cards and does not pretend to.
   */
  private async buildQuote(
    task: Task,
    bus: ExecutionEventBus,
    args: PlaceOrderArgs
  ): Promise<PendingOrder> {
    const address = args.address ?? DEFAULT_ADDRESS;
    const country = (args.country ?? address.country ?? "SE").toUpperCase();
    const items = args.items?.length
      ? args.items
      : [{ sku: "HT-NEBULA-PUR-L", quantity: 1 }];

    this.working(task, bus, "Pricing your basket…");
    const cart = await priceCart(items, country);
    if (cart.lines.length === 0) {
      throw new Error(
        `Nothing in the catalogue matched ${cart.unmatched.join(", ") || "that request"}.`
      );
    }

    this.working(task, bus, "Asking the shipping agent for delivery options…");
    const shippingResult = await callAgent({
      from: "checkout",
      to: "shipping",
      skill: "quote_shipping",
      contextId: task.contextId,
      text: `Delivery options for ${country}, basket ${cart.subtotalMinor} ${cart.currency}`,
      data: {
        country,
        orderAmountMinor: cart.subtotalMinor,
        address: {
          postalCode: address.postalCode,
          city: address.city,
          country,
        },
      },
    });

    const quote =
      "status" in shippingResult
        ? firstData<ShippingQuoteResult>(shippingResult.status?.message?.parts)
        : firstData<ShippingQuoteResult>(shippingResult.parts);

    if (!quote || quote.options.length === 0) {
      throw new Error("The shipping agent returned no options for that address.");
    }

    const chosen =
      quote.options.find((o) => o.id === args.shippingOptionId) ??
      [...quote.options].sort((a, b) => a.priceMinor - b.priceMinor)[0]!;

    return {
      kind: "pending-order",
      lines: cart.lines,
      currency: cart.currency,
      market: cart.market,
      subtotalMinor: cart.subtotalMinor,
      shippingMinor: chosen.priceMinor,
      totalMinor: cart.subtotalMinor + chosen.priceMinor,
      address: { ...address, country },
      shipping: {
        optionId: chosen.id,
        carrier: chosen.carrier,
        name: chosen.name,
        priceMinor: chosen.priceMinor,
        etaDays: chosen.etaDays,
      },
    };
  }

  private async quoteCart(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<PlaceOrderArgs>(ctx) ?? {};
    const quote = await this.buildQuote(task, bus, args);
    this.complete(
      task,
      bus,
      `${formatMinor(quote.totalMinor, quote.currency)} delivered — ${
        quote.shipping.name
      }, ${quote.shipping.etaDays.earliest}–${quote.shipping.etaDays.latest} days.`,
      quote
    );
  }

  /**
   * Prices, then stops. The quote rides along in the `input-required` status
   * message so the follow-up turn can pick it up without any server-side
   * session state — the task itself is the state.
   */
  private async placeOrder(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<PlaceOrderArgs>(ctx) ?? {};
    const quote = await this.buildQuote(task, bus, args);

    const summary = quote.lines
      .map((l) => `${l.quantity}× ${l.name}`)
      .join(", ");

    bus.publish(
      AgentEvent.statusUpdate(
        statusUpdate({
          taskId: task.id,
          contextId: task.contextId,
          state: TaskState.TASK_STATE_INPUT_REQUIRED,
          message: this.say(
            task,
            `${summary} to ${quote.address.city}, delivered by ${
              quote.shipping.name
            }. Total ${formatMinor(quote.totalMinor, quote.currency)} (${formatMinor(
              quote.subtotalMinor,
              quote.currency
            )} + ${formatMinor(
              quote.shippingMinor,
              quote.currency
            )} shipping). Confirm to place the order.`,
            quote
          ),
        })
      )
    );
  }

  /** The follow-up turn: commit, or stand down. */
  private async confirm(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task,
    pending: PendingOrder
  ): Promise<void> {
    if (!affirmative(requestText(ctx), requestData(ctx))) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_REJECTED,
            message: this.say(task, "Understood — I have not placed the order."),
          })
        )
      );
      return;
    }

    const orderId = nextOrderId();
    this.working(task, bus, `Confirmed. Booking delivery for ${orderId}…`);

    // Second outbound hop: shipping owns fulfilment, so the label is booked
    // over A2A too, not by reaching into a shared table.
    const booked = await callAgent({
      from: "checkout",
      to: "shipping",
      skill: "book_shipment",
      contextId: task.contextId,
      text: `Book ${pending.shipping.name} for ${orderId}`,
      data: {
        orderId,
        optionId: pending.shipping.optionId,
        country: pending.address.country,
        address: {
          postalCode: pending.address.postalCode,
          city: pending.address.city,
          country: pending.address.country,
        },
      },
    });

    const label =
      "status" in booked
        ? firstData<{ trackingId: string; carrier: string }>(
            booked.status?.message?.parts
          )
        : firstData<{ trackingId: string; carrier: string }>(booked.parts);

    const order: DemoOrder = {
      id: orderId,
      contextId: task.contextId,
      createdAt: Date.now(),
      currency: pending.currency,
      market: pending.market,
      lines: pending.lines,
      subtotalMinor: pending.subtotalMinor,
      shippingMinor: pending.shippingMinor,
      totalMinor: pending.totalMinor,
      address: pending.address,
      shipping: pending.shipping,
      status: "shipped",
    };
    demoState.orders.set(orderId, order);

    const confirmation = {
      orderId,
      total: formatMinor(order.totalMinor, order.currency),
      totalMinor: order.totalMinor,
      currency: order.currency,
      lines: order.lines,
      shipping: order.shipping,
      address: order.address,
      trackingId: label?.trackingId,
      carrier: label?.carrier ?? order.shipping.carrier,
      placedAt: new Date(order.createdAt).toISOString(),
    };

    bus.publish(
      AgentEvent.artifactUpdate({
        taskId: task.id,
        contextId: task.contextId,
        artifact: artifact({
          name: "order-confirmation",
          description: `Order ${orderId}`,
          parts: [dataPart(confirmation)],
        }),
        append: false,
        lastChunk: true,
        metadata: undefined,
      })
    );

    this.complete(
      task,
      bus,
      `Order ${orderId} placed — ${formatMinor(
        order.totalMinor,
        order.currency
      )}. Tracking id ${label?.trackingId ?? "pending"}.`,
      confirmation
    );
  }

  private async orderStatus(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<{ orderId?: string }>(ctx);
    const orderId =
      args?.orderId ?? requestText(ctx).match(/HT-\d+/i)?.[0]?.toUpperCase();

    if (!orderId) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_INPUT_REQUIRED,
            message: this.say(task, "Which order id should I look up?"),
          })
        )
      );
      return;
    }

    const order = demoState.orders.get(orderId);
    if (!order) {
      this.complete(task, bus, `I have no order ${orderId}.`, {
        orderId,
        found: false,
      });
      return;
    }

    this.complete(
      task,
      bus,
      `${orderId}: ${formatMinor(order.totalMinor, order.currency)}, ${
        order.status
      }, placed ${new Date(order.createdAt).toISOString()}.`,
      {
        orderId,
        found: true,
        status: order.status,
        placedAt: new Date(order.createdAt).toISOString(),
        currency: order.currency,
        subtotalMinor: order.subtotalMinor,
        shippingMinor: order.shippingMinor,
        totalMinor: order.totalMinor,
        lines: order.lines,
        shipping: order.shipping,
        address: order.address,
      }
    );
  }

  private async issueReplacement(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<{ orderId?: string; claimId?: string }>(ctx);
    const original = args?.orderId
      ? demoState.orders.get(args.orderId)
      : undefined;

    if (!original) {
      this.complete(
        task,
        bus,
        `I cannot replace ${args?.orderId ?? "an unknown order"} — no such order.`,
        { found: false }
      );
      return;
    }

    this.working(task, bus, `Creating a replacement for ${original.id}…`);

    const replacementId = nextOrderId();
    const replacement: DemoOrder = {
      ...original,
      id: replacementId,
      createdAt: Date.now(),
      subtotalMinor: 0,
      shippingMinor: 0,
      totalMinor: 0,
      status: "placed",
    };
    demoState.orders.set(replacementId, replacement);
    original.status = "replaced";

    const booked = await callAgent({
      from: "checkout",
      to: "shipping",
      skill: "book_shipment",
      contextId: task.contextId,
      text: `Book replacement delivery for ${replacementId}`,
      data: {
        orderId: replacementId,
        optionId: original.shipping.optionId,
        country: original.address.country,
        address: {
          postalCode: original.address.postalCode,
          city: original.address.city,
          country: original.address.country,
        },
      },
    });

    const label =
      "status" in booked
        ? firstData<{ trackingId: string }>(booked.status?.message?.parts)
        : firstData<{ trackingId: string }>(booked.parts);

    const payload = {
      replacementOrderId: replacementId,
      originalOrderId: original.id,
      claimId: args?.claimId,
      trackingId: label?.trackingId,
      chargedMinor: 0,
    };

    bus.publish(
      AgentEvent.artifactUpdate({
        taskId: task.id,
        contextId: task.contextId,
        artifact: artifact({
          name: "order-confirmation",
          description: `Replacement order ${replacementId}`,
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
      `Replacement ${replacementId} created at no charge, tracking ${
        label?.trackingId ?? "pending"
      }.`,
      payload
    );
  }
}

export const checkoutAgent: AgentDefinition = {
  id: "checkout",
  card: checkoutCard,
  executor: new CheckoutExecutor(),
};
