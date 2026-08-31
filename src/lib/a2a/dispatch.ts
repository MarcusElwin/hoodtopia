import type { RequestContext } from "@a2a-js/sdk/server";
import { CALLER_KEY, SKILL_KEY } from "./registry";
import { firstData, partsToText } from "./parts";

/**
 * Skill selection.
 *
 * A2A describes skills on the agent card but does not define how a caller picks
 * one on a request: the wire carries a natural-language message, not a method
 * name. That is deliberate — it keeps agents opaque — but it leaves every mesh
 * to invent its own convention.
 *
 * Ours: machine callers set a `hoodtopia.dev/skill` metadata key, and anything
 * without it falls back to classifying the message text. Agents calling agents
 * always take the first path, so an internal hop never depends on an LLM
 * guessing right. Buyers typing free text take the second.
 */

export function requestedSkill(ctx: RequestContext): string | undefined {
  const value = ctx.userMessage.metadata?.[SKILL_KEY];
  return typeof value === "string" ? value : undefined;
}

export function callerLabel(ctx: RequestContext): string {
  const value = ctx.userMessage.metadata?.[CALLER_KEY];
  return typeof value === "string" ? value : "unknown";
}

export function requestText(ctx: RequestContext): string {
  return partsToText(ctx.userMessage.parts);
}

export function requestData<T>(ctx: RequestContext): T | undefined {
  return firstData<T>(ctx.userMessage.parts);
}

export interface SkillRoute {
  id: string;
  /** Lower-cased keywords; any hit selects the skill. */
  keywords: string[];
}

/**
 * Keyword fallback for free-text requests.
 *
 * Intentionally not an LLM call: intent classification is not what this demo is
 * about, and a deterministic router keeps `fixtures` mode reproducible. The
 * `live` mode agents layer a model on top for the parts that genuinely need
 * language understanding — reading a claim narrative, mainly.
 */
export function classify(
  text: string,
  routes: SkillRoute[]
): string | undefined {
  const haystack = text.toLowerCase();
  let best: { id: string; score: number } | undefined;
  for (const route of routes) {
    const score = route.keywords.filter((k) => haystack.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { id: route.id, score };
    }
  }
  return best?.id;
}

/** Selects a skill from explicit metadata, then keywords, then a default. */
export function resolveSkill(
  ctx: RequestContext,
  routes: SkillRoute[],
  fallback: string
): string {
  return requestedSkill(ctx) ?? classify(requestText(ctx), routes) ?? fallback;
}
