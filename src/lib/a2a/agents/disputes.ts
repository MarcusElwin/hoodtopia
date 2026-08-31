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
import { isLive } from "../config";
import { requestData, requestText, resolveSkill, type SkillRoute } from "../dispatch";
import {
  agentMessage,
  artifact,
  dataPart,
  filePartSummaries,
  firstData,
  textPart,
} from "../parts";
import { formatMinor } from "../pricing";
import type { AgentDefinition } from "../runtime";
import { ContextIndex, newTask, statusUpdate } from "../status";
import {
  adjudicate,
  classifyClaim,
  CLAIM_WINDOW_DAYS,
  type ClaimFacts,
  type ClaimType,
} from "../claims-policy";
import {
  demoState,
  nextClaimId,
  type ClaimEvidence,
  type DemoClaim,
} from "../fixtures/store";

/**
 * Claims agent.
 *
 * This is the agent that could not exist without A2A. To decide a claim it
 * needs facts owned by two other parties — what was paid (checkout) and what
 * the carrier actually did (shipping) — and it has no database access to
 * either. So it asks them, over the same protocol a stranger would use, and
 * decides on what comes back.
 *
 * It also shows the two protocol features a commerce claim actually needs:
 * `input-required` to ask the buyer for a photo, and multi-part messages so
 * that photo can arrive as bytes rather than a link the agent has to trust.
 */

const ROUTES: SkillRoute[] = [
  { id: "open_claim", keywords: ["claim", "damaged", "broken", "refund", "return", "never arrived", "wrong"] },
  { id: "claim_status", keywords: ["claim status", "my claim", "clm-"] },
];

/** Built per request: the card carries an absolute, origin-specific URL. */
export const disputesCard = () =>
  buildAgentCard({
  id: "disputes",
  name: "Hoodtopia Claims Agent",
  description:
    "Handles post-purchase claims — damage, non-delivery, wrong item. Gathers evidence from the checkout and shipping agents over A2A, then decides a refund, replacement, rejection, or escalation against a published policy.",
  version: "1.0.0",
  documentationUrl:
    "https://github.com/MarcusElwin/hoodtopia/blob/main/docs/A2A_INTEGRATION.md",
  skills: [
    skill({
      id: "open_claim",
      name: "Open a claim",
      description:
        `Opens a claim against an order. Asks for photographic evidence where the claim type needs it, then adjudicates within the ${CLAIM_WINDOW_DAYS}-day window using order facts from the checkout agent and delivery evidence from the shipping agent.`,
      tags: ["claims", "returns", "disputes", "after-sales"],
      examples: [
        "My hoodie from HT-10001 arrived soaked and the print is peeling.",
        "Order HT-10002 never arrived.",
      ],
      inputModes: ["text/plain", "application/json", "image/jpeg", "image/png"],
    }),
    skill({
      id: "claim_status",
      name: "Check a claim",
      description:
        "Returns the current state of a claim and, once decided, the outcome with the reasoning and the evidence it rested on.",
      tags: ["claims", "status"],
      examples: ["What happened with claim CLM-2001?"],
    }),
  ],
});

interface OpenClaimArgs {
  orderId?: string;
  reason?: string;
}

interface OrderStatusPayload {
  found: boolean;
  status?: string;
  placedAt?: string;
  totalMinor?: number;
  currency?: string;
}

interface ShipmentEvidencePayload {
  found: boolean;
  delivered?: boolean;
  deliveredTo?: string;
  trackingId?: string;
  scans?: Array<{ stage: string; label: string; at: string }>;
}

/** The claim this task is about, recovered from the task's own history. */
function claimFrom(task: Task | undefined): DemoClaim | undefined {
  if (!task) return undefined;
  const fromStatus = firstData<{ claimId?: string }>(task.status?.message?.parts);
  if (fromStatus?.claimId) return demoState.claims.get(fromStatus.claimId);
  for (const message of [...(task.history ?? [])].reverse()) {
    const data = firstData<{ claimId?: string }>(message.parts);
    if (data?.claimId) return demoState.claims.get(data.claimId);
  }
  return undefined;
}

/**
 * Classifies the buyer's narrative. In `live` mode a model reads it; otherwise
 * keywords do. Either way the *decision* stays with the policy table — the
 * model never gets a vote on whether money moves.
 *
 * A claim narrative is attacker-controlled text arriving from outside the
 * merchant's trust boundary, so it goes through the same input guardrails as
 * every other model call in this app (length cap, injection detection,
 * moderation, safety logging) before it reaches a prompt. The policy table
 * already stops a claim from *talking* its way to a refund; the guardrails
 * stop it reaching the model at all. Anything flagged falls back to keyword
 * classification rather than failing the claim — a buyer whose wording trips a
 * filter still deserves an answer.
 */
async function classify(text: string, claimId: string): Promise<ClaimType> {
  if (!isLive() || !process.env.OPENAI_API_KEY) return classifyClaim(text);

  const { runInputGuardrails } = await import("@/lib/ai/guardrails");
  const guard = await runInputGuardrails({
    sessionId: `a2a-claim:${claimId}`,
    userMessage: text,
  });
  if (!guard.allowed) return classifyClaim(text);

  try {
    const { ChatOpenAI } = await import("@langchain/openai");
    const { z } = await import("zod");
    const model = new ChatOpenAI({
      model: "gpt-5.4-mini",
      apiKey: process.env.OPENAI_API_KEY,
    });
    const schema = z.object({
      type: z.enum(["damaged", "not_received", "wrong_item", "other"]),
    });
    const result = await model
      .withStructuredOutput(schema)
      .invoke([
        {
          role: "system",
          content:
            "Classify a retail claim into exactly one category. Answer only with the category.",
        },
        { role: "user", content: guard.userMessage },
      ]);
    return result.type;
  } catch {
    return classifyClaim(text);
  }
}

class DisputesExecutor implements AgentExecutor {
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

    try {
      const pending = claimFrom(ctx.task);
      if (
        ctx.task?.status?.state === TaskState.TASK_STATE_INPUT_REQUIRED &&
        pending
      ) {
        await this.receiveEvidence(ctx, bus, task, pending);
        return;
      }

      switch (resolveSkill(ctx, ROUTES, "open_claim")) {
        case "claim_status":
          await this.claimStatus(ctx, bus, task);
          break;
        default:
          await this.openClaim(ctx, bus, task);
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
              error instanceof Error ? error.message : "Claim handling failed"
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

  /**
   * Opens the claim and stops. Photographic evidence is requested up front for
   * claim types that need it rather than after an investigation, so the buyer
   * is asked once.
   */
  private async openClaim(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<OpenClaimArgs>(ctx) ?? {};
    const text = requestText(ctx);
    const orderId =
      args.orderId ?? text.match(/HT-\d+/i)?.[0]?.toUpperCase() ?? "";
    const reason = args.reason ?? text;

    if (!orderId) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_INPUT_REQUIRED,
            message: this.say(
              task,
              "Which order is the claim about? I need the order id to start."
            ),
          })
        )
      );
      return;
    }

    const claim: DemoClaim = {
      id: nextClaimId(),
      contextId: task.contextId,
      orderId,
      createdAt: Date.now(),
      reason,
      evidence: filePartSummaries(ctx.userMessage.parts).map(
        (f): ClaimEvidence => ({
          filename: f.filename,
          mediaType: f.mediaType,
          bytes: f.bytes ?? 0,
        })
      ),
      status: "awaiting-evidence",
    };
    demoState.claims.set(claim.id, claim);

    const type = await classify(reason, claim.id);

    // A photo is only worth asking for when it can change the outcome.
    if (type === "damaged" && claim.evidence.length === 0) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_INPUT_REQUIRED,
            message: this.say(
              task,
              `Claim ${claim.id} opened against ${orderId}. Send a photo of the damage and I will decide it.`,
              { claimId: claim.id, orderId, claimType: type, needs: "photo" }
            ),
          })
        )
      );
      return;
    }

    await this.decide(bus, task, claim, type);
  }

  /** The follow-up turn carrying the photo. */
  private async receiveEvidence(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task,
    claim: DemoClaim
  ): Promise<void> {
    const files = filePartSummaries(ctx.userMessage.parts);
    if (files.length === 0) {
      bus.publish(
        AgentEvent.statusUpdate(
          statusUpdate({
            taskId: task.id,
            contextId: task.contextId,
            state: TaskState.TASK_STATE_INPUT_REQUIRED,
            message: this.say(
              task,
              "I still need a photo of the damage before I can decide this.",
              { claimId: claim.id, needs: "photo" }
            ),
          })
        )
      );
      return;
    }

    claim.evidence.push(
      ...files.map((f) => ({
        filename: f.filename || "evidence",
        mediaType: f.mediaType,
        bytes: f.bytes ?? 0,
      }))
    );

    await this.decide(bus, task, claim, await classify(claim.reason, claim.id));
  }

  /**
   * Gathers facts from the other two agents and applies the policy. Both calls
   * are ordinary A2A `message/send` requests — the claims agent has no
   * privileged read into either peer.
   */
  private async decide(
    bus: ExecutionEventBus,
    task: Task,
    claim: DemoClaim,
    type: ClaimType
  ): Promise<void> {
    claim.status = "investigating";

    this.working(task, bus, `Asking the checkout agent about ${claim.orderId}…`);
    const orderResult = await callAgent({
      from: "disputes",
      to: "checkout",
      skill: "order_status",
      contextId: task.contextId,
      text: `Order facts for ${claim.orderId}`,
      data: { orderId: claim.orderId },
    });
    const order =
      "status" in orderResult
        ? firstData<OrderStatusPayload>(orderResult.status?.message?.parts)
        : firstData<OrderStatusPayload>(orderResult.parts);

    this.working(task, bus, "Asking the shipping agent for delivery evidence…");
    const shipmentResult = await callAgent({
      from: "disputes",
      to: "shipping",
      skill: "shipment_evidence",
      contextId: task.contextId,
      text: `Delivery evidence for ${claim.orderId}`,
      data: { orderId: claim.orderId },
    });
    const shipment =
      "status" in shipmentResult
        ? firstData<ShipmentEvidencePayload>(
            shipmentResult.status?.message?.parts
          )
        : firstData<ShipmentEvidencePayload>(shipmentResult.parts);

    const facts: ClaimFacts = {
      orderFound: Boolean(order?.found),
      orderStatus: order?.status,
      totalMinor: order?.totalMinor,
      currency: order?.currency,
      placedAt: order?.placedAt,
      shipmentFound: Boolean(shipment?.found),
      delivered: Boolean(shipment?.delivered),
      deliveredTo: shipment?.deliveredTo,
      lastScanLabel: shipment?.scans?.at(-1)?.label,
      evidenceCount: claim.evidence.length,
    };

    this.working(task, bus, "Applying the claims policy…");
    const decision = adjudicate(type, facts);

    let replacementOrderId: string | undefined;
    if (decision.outcome === "replacement") {
      // Deciding a replacement is not the same as creating one. The claims
      // agent cannot write orders, so it asks the agent that can.
      const replacement = await callAgent({
        from: "disputes",
        to: "checkout",
        skill: "issue_replacement",
        contextId: task.contextId,
        text: `Replacement approved for ${claim.orderId} under claim ${claim.id}`,
        data: { orderId: claim.orderId, claimId: claim.id },
      });
      const payload =
        "status" in replacement
          ? firstData<{ replacementOrderId?: string }>(
              replacement.status?.message?.parts
            )
          : firstData<{ replacementOrderId?: string }>(replacement.parts);
      replacementOrderId = payload?.replacementOrderId;
    }

    claim.status = "resolved";
    claim.resolution = {
      outcome: decision.outcome,
      rationale: decision.rationale,
      evidenceUsed: decision.evidenceUsed,
      refundMinor: decision.refundMinor,
      replacementOrderId,
    };

    const resolution = {
      claimId: claim.id,
      orderId: claim.orderId,
      claimType: type,
      outcome: decision.outcome,
      rationale: decision.rationale,
      evidenceUsed: decision.evidenceUsed,
      evidenceFiles: claim.evidence,
      refund:
        decision.refundMinor !== undefined && facts.currency
          ? {
              minor: decision.refundMinor,
              formatted: formatMinor(decision.refundMinor, facts.currency),
              currency: facts.currency,
            }
          : undefined,
      replacementOrderId,
      decidedAt: new Date().toISOString(),
    };

    bus.publish(
      AgentEvent.artifactUpdate({
        taskId: task.id,
        contextId: task.contextId,
        artifact: artifact({
          name: "claim-resolution",
          description: `Decision on claim ${claim.id}`,
          parts: [dataPart(resolution)],
        }),
        append: false,
        lastChunk: true,
        metadata: undefined,
      })
    );

    bus.publish(
      AgentEvent.statusUpdate(
        statusUpdate({
          taskId: task.id,
          contextId: task.contextId,
          state: TaskState.TASK_STATE_COMPLETED,
          message: this.say(
            task,
            `${claim.id}: ${decision.outcome}. ${decision.rationale}`,
            resolution
          ),
        })
      )
    );
  }

  private async claimStatus(
    ctx: RequestContext,
    bus: ExecutionEventBus,
    task: Task
  ): Promise<void> {
    const args = requestData<{ claimId?: string }>(ctx);
    const claimId =
      args?.claimId ?? requestText(ctx).match(/CLM-\d+/i)?.[0]?.toUpperCase();
    const claim = claimId ? demoState.claims.get(claimId) : undefined;

    bus.publish(
      AgentEvent.statusUpdate(
        statusUpdate({
          taskId: task.id,
          contextId: task.contextId,
          state: TaskState.TASK_STATE_COMPLETED,
          message: this.say(
            task,
            claim
              ? `${claim.id} is ${claim.status}${
                  claim.resolution ? ` — ${claim.resolution.outcome}` : ""
                }.`
              : `I have no claim ${claimId ?? "matching that"}.`,
            claim
              ? {
                  claimId: claim.id,
                  orderId: claim.orderId,
                  status: claim.status,
                  resolution: claim.resolution,
                }
              : { found: false }
          ),
        })
      )
    );
  }
}

export const disputesAgent = (): AgentDefinition => ({
  id: "disputes",
  card: disputesCard(),
  executor: new DisputesExecutor(),
});
