import { a2aOrigin } from "./config";

/**
 * The three merchant-side agents. In production these would be three separate
 * deployments owned by three different teams (or three different companies —
 * that is the whole point of A2A). Here they are three route namespaces in one
 * Next.js app: separate agent cards, separate endpoints, and real HTTP hops
 * between them, but a single deploy.
 */
export const AGENT_IDS = ["checkout", "shipping", "disputes"] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

/** The JSON-RPC endpoint an agent card advertises. */
export function agentEndpoint(id: AgentId): string {
  return `${a2aOrigin()}/a2a/${id}`;
}

/** Path tail the A2A spec defines for an agent card. */
export const AGENT_CARD_TAIL = ".well-known/agent-card.json";

/**
 * Discovery URL for an agent. The A2A well-known path is per-origin, so a
 * single origin hosting three agents has to namespace it. Clients that already
 * hold the card URL are unaffected; only "guess the card from the domain"
 * discovery needs the origin-level path, which is a real limitation of putting
 * several agents behind one host.
 */
export function agentCardUrl(id: AgentId): string {
  return `${agentEndpoint(id)}/${AGENT_CARD_TAIL}`;
}

/**
 * Metadata key carrying the skill a caller wants. A2A standardises *describing*
 * skills on the agent card but not *selecting* one on a request: the wire
 * format is a natural-language message. Machine callers (an agent calling
 * another agent) should not have to round-trip through an LLM just to say which
 * skill they mean, so the mesh agrees on this metadata key and falls back to
 * intent classification when it is absent.
 */
export const SKILL_KEY = "hoodtopia.dev/skill";

/** Metadata key identifying the calling party, used to draw the trace graph. */
export const CALLER_KEY = "hoodtopia.dev/caller";
