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
import {
  agentMessage,
  artifact,
  dataPart,
  firstData,
  partsToText,
  textPart,
} from "../parts";
import { askFor, extractOrder } from "../intent";
import { formatMinor, priceCart, type RequestedLine } from "../pricing";
import type { AgentDefinition } from "../runtime";
import { ContextIndex, newTask, statusUpdate } from "../status";
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
  // "Where is my package" is a question about an order, not a request for a
  // new one. It reaches the checkout agent because that is who the buyer
  // bought from; answering it means asking the shipping agent, which is the
  // whole point of the mesh.
  {
    id: "order_status",
    keywords: [
      "status",
      "look up",
      "find order",
      "details",
      "where is",
      "where's",
      "my package",
      "my parcel",
      "my order",
      "track",
      "tracking",
      "arrived yet",
    ],
  },
  { id: "issue_replacement", keywords: ["replacement", "resend", "send another"] },
];

/** Built per request: the card carries an absolute, origin-specific URL. */
export const checkoutCard = () =>
  buildAgentCard({
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

interface PendingInfo {
  kind: "pending-info";
  /** The skill that was interrupted, so the answer resumes it. */
  skill: string;
  items?: RequestedLine[];
  country?: string;
  address?: DemoAddress;
}

/**
 * Raised when the request does not say enough to price anything.
 *
 * Carries what was understood so far, so the follow-up turn resumes the
 * original intent instead of re-reading a one-word reply from scratch.
 */
class NeedsMoreInfo extends Error {
  constructor(
    readonly question: string,
    readonly pending: PendingInfo
  ) {
    super(question);
  }
}

/**
 * Phrases that point back at something already discussed. Deliberately narrow:
 * the cost of missing one is an extra question, and the cost of matching too
 * eagerly is answering a new question with an old answer.
 */
const BACK_REFERENCE =
  /\b(them|these|those|it|that one|the same|same one|as quoted|the quote|previous)\b/i;

/** The most recent priced basket among earlier tasks in this conversation. */
function lastQuoteAmong(tasks: Task[]): PendingOrder | undefined {
  for (const task of [...tasks].reverse()) {
    const fromStatus = firstData<PendingOrder>(task.status?.message?.parts);
    if (fromStatus?.kind === "pending-order") return fromStatus;
    for (const message of [...(task.history ?? [])].reverse()) {
      const data = firstData<PendingOrder>(message.parts);
      if (data?.kind === "pending-order") return data;
    }
  }
  return undefined;
}

/** The unfinished request this task was waiting on, if any. */
function pendingInfoFrom(task: Task | undefined): PendingInfo | undefined {
  if (!task) return undefined;
  const fromStatus = firstData<PendingInfo>(task.status?.message?.parts);
  if (fromStatus?.kind === "pending-info") return fromStatus;
  for (const message of [...(task.history ?? [])].reverse()) {
    const data = firstData<PendingInfo>(message.parts);
    if (data?.kind === "pending-info") return data;
  }
  return undefined;
}

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
    this.contexts.remember(task.id, task.contextId);
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

      // An answer to "which hoodie, and where?" resumes the request that asked
      // it, rather than being re-routed as a fresh one — "London" on its own
      // carries no keywords and would otherwise land on the default skill.
      const unfinished =
        ctx.task?.status?.state === TaskState.TASK_STATE_INPUT_REQUIRED
          ? pendingInfoFrom(ctx.task)
          : undefined;

      if (unfinished) {
        const merged: PlaceOrderArgs = {
          items: unfinished.items?.length ? unfinished.items : undefined,
          country: unfinished.country,
          address: unfinished.address,
        };
        if (unfinished.skill === "order_status") {
          await this.orderStatus(ctx, bus, task);
        } else if (unfinished.skill === "place_order") {
          await this.placeOrder(ctx, bus, task, merged);
        } else {
          await this.quoteCart(ctx, bus, task, merged);
        }
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
      // A request that did not say enough is a conversation to continue, not a
      // failure to report.
      const needsInfo = error instanceof NeedsMoreInfo;
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: needsInfo
              ? TaskState.TASK_STATE_INPUT_REQUIRED
              : TaskState.TASK_STATE_FAILED,
            message: this.say(
              task,
              error instanceof Error ? error.message : "Checkout failed",
              needsInfo ? error.pending : undefined
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
    args: PlaceOrderArgs,
    text = "",
    skill = "quote_cart",
    earlier: Task[] = []
  ): Promise<PendingOrder> {
    // Structured arguments win. Where they are absent — a buyer's agent
    // writing plain prose — read what the sentence actually says, and ask
    // about whatever it did not. Defaulting here would mean handing back a
    // confirmable total for a product nobody named.
    let items: RequestedLine[] = args.items?.length ? args.items : [];
    let address = args.address;
    let country = args.country ?? args.address?.country;

    if (items.length === 0 || !country) {
      const extracted = extractOrder(text);
      if (items.length === 0) items = extracted.items;
      address ??= extracted.address;
      country ??= extracted.country;

      // Still short? Inherit from an earlier task in this conversation before
      // asking again — a buyer who just priced two hoodies and says "I want to
      // buy them" has already told us what "them" is.
      //
      // Only for a message that is actually continuing that request, though.
      // A question this agent did not understand names no product either, and
      // answering it with the last cart's total is worse than admitting the
      // question did not land: it is confidently, specifically wrong.
      const continues =
        items.length > 0 ||
        Boolean(country) ||
        address !== undefined ||
        BACK_REFERENCE.test(text);

      if ((items.length === 0 || !country) && continues) {
        const previous = lastQuoteAmong(earlier);
        if (previous) {
          if (items.length === 0) items = previous.lines.map((l) => ({ sku: l.sku, quantity: l.quantity }));
          address ??= previous.address;
          country ??= previous.address?.country;
        }
      }

      const missing = [
        ...(items.length === 0 ? (["product"] as const) : []),
        ...(!country ? (["destination"] as const) : []),
      ];
      if (missing.length > 0) {
        throw new NeedsMoreInfo(askFor([...missing]), {
          kind: "pending-info",
          skill,
          items,
          country,
          address,
        });
      }
    }

    country = country!.toUpperCase();
    address ??= {
      name: "Demo Shopper",
      street: "",
      postalCode: "",
      city: "",
      country,
    };

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
    task: Task,
    carried?: PlaceOrderArgs
  ): Promise<void> {
    const args = { ...carried, ...(requestData<PlaceOrderArgs>(ctx) ?? {}) };
    const quote = await this.buildQuote(
      task,
      bus,
      args,
      requestText(ctx),
      "quote_cart",
      ctx.referenceTasks ?? []
    );
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
    task: Task,
    carried?: PlaceOrderArgs
  ): Promise<void> {
    const args = { ...carried, ...(requestData<PlaceOrderArgs>(ctx) ?? {}) };
    const quote = await this.buildQuote(
      task,
      bus,
      args,
      requestText(ctx),
      "place_order",
      ctx.referenceTasks ?? []
    );

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
      // Marked as an unfinished order_status request, so the order id that
      // comes back next turn resumes this lookup instead of being re-routed
      // as a brand new request that happens to mention nothing.
      throw new NeedsMoreInfo(
        this.knownOrders()
          ? `Which order id should I look up? I have ${this.knownOrders()}.`
          : "Which order id should I look up?",
        { kind: "pending-info", skill: "order_status", items: [] }
      );
    }

    const order = demoState.orders.get(orderId);
    if (!order) {
      this.complete(task, bus, `I have no order ${orderId}.`, {
        orderId,
        found: false,
      });
      return;
    }

    // Where the parcel is is not something this agent knows. It owns the
    // order; the carrier relationship belongs to the shipping agent, and the
    // only way across that line is to ask.
    const carrier = await this.carrierView(task, orderId);

    this.complete(
      task,
      bus,
      `${orderId}: ${formatMinor(order.totalMinor, order.currency)}, ${
        order.status
      }, placed ${new Date(order.createdAt).toISOString()}.${
        carrier ? ` ${carrier.summary}` : ""
      }`,
      {
        orderId,
        found: true,
        status: order.status,
        placedAt: new Date(order.createdAt).toISOString(),
        currency: order.currency,
        shipment: carrier?.data,
        subtotalMinor: order.subtotalMinor,
        shippingMinor: order.shippingMinor,
        totalMinor: order.totalMinor,
        lines: order.lines,
        shipping: order.shipping,
        address: order.address,
      }
    );
  }

  /**
   * Order ids this agent has, named in the question so a buyer is not asked to
   * guess. Cheap to do here, and impossible for anyone outside the merchant.
   */
  private knownOrders(): string | undefined {
    const ids = [...demoState.orders.keys()].slice(-3);
    return ids.length > 0 ? ids.join(", ") : undefined;
  }

  /**
   * Asks the shipping agent where a parcel is.
   *
   * `shipment_evidence` rather than `track_shipment`: tracking is the
   * long-running skill that streams until delivery, which is right for a
   * scripted lifecycle and wrong for someone waiting on a chat reply.
   *
   * A carrier that cannot be reached is not a reason to fail the lookup — the
   * order details are still true — so this returns nothing and the answer is
   * shorter.
   */
  private async carrierView(
    task: Task,
    orderId: string
  ): Promise<{ summary: string; data: unknown } | undefined> {
    try {
      const result = await callAgent({
        from: "checkout",
        to: "shipping",
        skill: "shipment_evidence",
        contextId: task.contextId,
        text: `Where is the parcel for ${orderId}?`,
        data: { orderId },
      });

      const data = firstData<{ found?: boolean }>(
        "status" in result ? result.status?.message?.parts : result.parts
      );
      if (!data?.found) return undefined;

      const summary =
        "status" in result
          ? partsToText(result.status?.message?.parts)
          : partsToText(result.parts);
      return summary ? { summary, data } : undefined;
    } catch {
      return undefined;
    }
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

export const checkoutAgent = (): AgentDefinition => ({
  id: "checkout",
  card: checkoutCard(),
  executor: new CheckoutExecutor(),
});
