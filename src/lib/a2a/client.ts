import { randomUUID } from "node:crypto";
import type { Part, StreamResponse } from "@a2a-js/sdk";
import {
  Message,
  SendMessageRequest,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from "@a2a-js/sdk";
import { AgentCardResolver, Client, ClientFactory } from "@a2a-js/sdk/client";
import { agentCardUrl, CALLER_KEY, SKILL_KEY, type AgentId } from "./registry";
import { dataPart, partsToText, textPart, userMessage } from "./parts";
import { stateSlug } from "./status";
import { traceBus } from "./trace";
import { verifyCard, type VerificationResult } from "./signing";

/**
 * The client side of the mesh.
 *
 * Used by two very different callers, deliberately through the same code path:
 * the buyer's shopper agent, and the merchant agents when they call each other.
 * That symmetry is the point of A2A — the checkout agent talking to the shipping
 * agent is doing exactly what an external buyer agent does, over the same wire,
 * with no privileged back door.
 */

const clients = new Map<AgentId, Promise<Client>>();
const verifications = new Map<AgentId, VerificationResult>();

/**
 * Discovers an agent and verifies its card before using it.
 *
 * The card is fetched and checked first, and only then handed to the client
 * factory. That ordering is the whole point: a card is a claim about who an
 * agent is, and checking it after you have already transacted is theatre.
 *
 * A card that fails verification is refused outright. An *unsigned* card is
 * allowed through with the outcome recorded, because refusing those would make
 * the mesh unable to talk to any agent that has not adopted v1.0 signing yet —
 * a real deployment would decide that per counterparty rather than globally.
 */
async function discover(
  id: AgentId,
  contextId: string,
  by: string
): Promise<Client> {
  const cardUrl = agentCardUrl(id);
  // The card URL is passed whole with an empty relative path: the agents are
  // namespaced under /a2a/<id>/, so the default per-origin well-known lookup
  // would resolve to the wrong place.
  const card = await AgentCardResolver.default.resolve(cardUrl, "");

  const verification = await verifyCard(card, cardUrl);
  verifications.set(id, verification);

  traceBus.record({
    contextId,
    kind: verification.status === "invalid" ? "error" : "status",
    // Whoever needed the card first is the one who verified it — often the
    // checkout agent rather than the buyer.
    from: by,
    to: id,
    method: "GetAgentCard",
    state: verification.status,
    summary:
      verification.status === "verified"
        ? `Card signature verified (kid ${verification.kid ?? "unknown"}).`
        : verification.status === "unsigned"
          ? "Card is unsigned — proceeding, but nothing vouches for it."
          : `Card signature INVALID: ${verification.detail}`,
    detail: { cardUrl, ...verification },
  });

  if (verification.status === "invalid") {
    throw new Error(
      `Refusing to talk to ${id}: its agent card failed signature verification (${verification.detail}).`
    );
  }

  return new ClientFactory().createFromAgentCard(card);
}

function clientFor(
  id: AgentId,
  contextId: string,
  by: string
): Promise<Client> {
  let existing = clients.get(id);
  if (!existing) {
    existing = discover(id, contextId, by);
    clients.set(id, existing);
  }
  return existing;
}

/** Verification outcome per agent, for the demo page. */
export function verificationResults(): Record<string, VerificationResult> {
  return Object.fromEntries(verifications);
}

export interface CallInit {
  /** Trace label for the caller: `shopper`, or the calling agent's id. */
  from: string;
  to: AgentId;
  /** Skill to invoke. Omitted for free-text, which the agent classifies. */
  skill?: string;
  text?: string;
  /** Structured arguments, sent as a data part alongside the text. */
  data?: unknown;
  /** Additional parts, e.g. a photo attached to a claim. */
  parts?: Part[];
  contextId?: string;
  /** Set to continue an existing task, e.g. answering an `input-required`. */
  taskId?: string;
  /**
   * Earlier tasks this message builds on. The server loads them and hands them
   * to the executor, which is how a new task inherits what an earlier one
   * established — "buy them" knowing what "them" refers to.
   */
  referenceTaskIds?: string[];
}

function buildRequest(init: CallInit): SendMessageRequest {
  const parts: Part[] = [];
  if (init.text) parts.push(textPart(init.text));
  if (init.data !== undefined) parts.push(dataPart(init.data));
  if (init.parts) parts.push(...init.parts);

  const metadata: Record<string, unknown> = { [CALLER_KEY]: init.from };
  if (init.skill) metadata[SKILL_KEY] = init.skill;

  return {
    tenant: "",
    message: userMessage({
      parts,
      contextId: init.contextId,
      taskId: init.taskId,
      metadata,
      referenceTaskIds: init.referenceTaskIds,
    }),
    configuration: undefined,
    metadata: undefined,
  };
}

/**
 * Proto-JSON for the inspector. The SDK's in-memory shapes are not the wire
 * shapes — enums are numeric, `oneof`s are tagged objects — so a panel claiming
 * to show the wire has to run the values back through the codec.
 */
function wire<T>(codec: { toJSON(value: T): unknown }, value: T): unknown {
  try {
    return codec.toJSON(value);
  } catch {
    return value;
  }
}

function summarise(result: Message | Task): string {
  if ("status" in result) {
    const text = partsToText(result.status?.message?.parts);
    return text || `task ${stateSlug(result.status?.state)}`;
  }
  return partsToText(result.parts) || "message";
}

/**
 * Sends a message and blocks until the agent reaches a terminal or interrupted
 * state, recording both ends of the hop on the trace bus.
 */
export async function callAgent(init: CallInit): Promise<Message | Task> {
  const contextId = init.contextId ?? randomUUID();
  const request = buildRequest({ ...init, contextId });
  const startedAt = Date.now();

  traceBus.record({
    contextId,
    taskId: init.taskId,
    kind: "request",
    from: init.from,
    to: init.to,
    method: "SendMessage",
    skill: init.skill,
    summary: init.text ?? init.skill ?? "message",
    detail: wire(SendMessageRequest, request),
  });

  try {
    const client = await clientFor(init.to, contextId, init.from);
    const result = await client.sendMessage(request);

    traceBus.record({
      contextId,
      taskId: "status" in result ? result.id : undefined,
      kind: "response",
      from: init.to,
      to: init.from,
      method: "SendMessage",
      skill: init.skill,
      state: "status" in result ? stateSlug(result.status?.state) : undefined,
      summary: summarise(result),
      detail:
        "status" in result
          ? wire(Task, result)
          : wire(Message, result),
      latencyMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    traceBus.record({
      contextId,
      taskId: init.taskId,
      kind: "error",
      from: init.to,
      to: init.from,
      method: "SendMessage",
      skill: init.skill,
      summary: error instanceof Error ? error.message : "call failed",
      detail: { error: String(error) },
      latencyMs: Date.now() - startedAt,
    });
    throw error;
  }
}

/**
 * Streaming variant. Yields raw `StreamResponse` frames and traces each one, so
 * a long-running task (a parcel in transit) shows up on the timeline as it
 * moves rather than only at the end.
 */
export async function* streamAgent(
  init: CallInit
): AsyncGenerator<StreamResponse, void, undefined> {
  const contextId = init.contextId ?? randomUUID();
  const request = buildRequest({ ...init, contextId });

  traceBus.record({
    contextId,
    taskId: init.taskId,
    kind: "request",
    from: init.from,
    to: init.to,
    method: "SendStreamingMessage",
    skill: init.skill,
    summary: init.text ?? init.skill ?? "message",
    detail: wire(SendMessageRequest, request),
  });

  const client = await clientFor(init.to, contextId, init.from);

  for await (const frame of client.sendMessageStream(request)) {
    const payload = frame.payload;
    if (payload?.$case === "statusUpdate") {
      traceBus.record({
        contextId,
        taskId: payload.value.taskId,
        kind: "status",
        from: init.to,
        to: init.from,
        method: "SendStreamingMessage",
        skill: init.skill,
        state: stateSlug(payload.value.status?.state),
        summary:
          partsToText(payload.value.status?.message?.parts) ||
          stateSlug(payload.value.status?.state),
        detail: wire(TaskStatusUpdateEvent, payload.value),
      });
    } else if (payload?.$case === "artifactUpdate") {
      traceBus.record({
        contextId,
        taskId: payload.value.taskId,
        kind: "artifact",
        from: init.to,
        to: init.from,
        method: "SendStreamingMessage",
        skill: init.skill,
        summary: payload.value.artifact?.name ?? "artifact",
        detail: wire(TaskArtifactUpdateEvent, payload.value),
      });
    }
    yield frame;
  }
}

/** Fetches an agent's card — what a stranger sees before deciding to transact. */
export async function fetchAgentCard(id: AgentId, contextId = "discovery") {
  const client = await clientFor(id, contextId, "shopper");
  return client.getAgentCard();
}

/** Clears cached clients. Used by tests, and after an origin change in dev. */
export function resetClients(): void {
  clients.clear();
  verifications.clear();
}
