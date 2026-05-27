import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { db, chatSafetyEvents } from "@/db";

// Layered defences for the public AI chat. We check three things before
// the user message hits the LLM:
//   1. Pattern-based prompt-injection detection (cheap, deterministic)
//   2. OpenAI Moderation API (free, async, catches hate/violence/sexual)
//   3. Per-session rate limit (in-memory; fine for a single Vercel region
//      demo, swap for Upstash if we ever go multi-region)
// All flagged events get logged to chat_safety_events for later review.

// ───────────────────────────────────────────────────────────────────────
// Pattern-based prompt-injection detection.
// These are common jailbreak prefixes. Not exhaustive — adversaries will
// always find new wording — but they catch the lazy 90% with zero latency.
// ───────────────────────────────────────────────────────────────────────
const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore\s+(\w+\s+){0,3}(previous|prior|above|all)\s*(instructions|rules|prompts)/i, label: "ignore-instructions" },
  { pattern: /disregard\s+(\w+\s+){0,3}(previous|prior|above|all)\s*(instructions|rules)/i, label: "disregard-instructions" },
  { pattern: /forget\s+(everything|all\s+previous|the\s+system)/i, label: "forget-context" },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i, label: "role-override" },
  { pattern: /act\s+as\s+(a|an|if\s+you)/i, label: "act-as" },
  { pattern: /pretend\s+(to\s+be|you\s+are)/i, label: "pretend" },
  { pattern: /system\s*[:>]\s*/i, label: "fake-system-tag" },
  { pattern: /<\s*\/?\s*(system|assistant|user)\s*>/i, label: "fake-role-tag" },
  { pattern: /reveal\s+(your|the)\s+(system\s+)?prompt/i, label: "leak-system-prompt" },
  { pattern: /(show|print|output|repeat).*(system\s+prompt|instructions|initial\s+prompt)/i, label: "leak-instructions" },
  { pattern: /developer\s+mode/i, label: "developer-mode" },
  { pattern: /jailbreak/i, label: "jailbreak-keyword" },
  { pattern: /DAN\s+mode/i, label: "dan-mode" },
];

export interface InjectionCheck {
  flagged: boolean;
  /** Labels of every pattern that matched (for logging / debugging). */
  reasons: string[];
}

export function detectPromptInjection(text: string): InjectionCheck {
  const reasons = INJECTION_PATTERNS.filter((p) => p.pattern.test(text)).map(
    (p) => p.label
  );
  return { flagged: reasons.length > 0, reasons };
}

// ───────────────────────────────────────────────────────────────────────
// OpenAI moderation. Free endpoint; returns categories (sexual, violence,
// hate, self-harm, etc.) with confidence scores. We only block on the
// flagged boolean — fine-grained scoring isn't worth the complexity.
// ───────────────────────────────────────────────────────────────────────
let _modClient: OpenAI | null = null;
function modClient(): OpenAI {
  if (!_modClient) {
    _modClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _modClient;
}

export interface ModerationCheck {
  flagged: boolean;
  categories: string[];
  /** Set when the API call itself failed; we fail-open so a moderation
   * outage doesn't take down chat. */
  error?: string;
}

export async function moderateInput(text: string): Promise<ModerationCheck> {
  if (!process.env.OPENAI_API_KEY) {
    return { flagged: false, categories: [], error: "no-api-key" };
  }
  try {
    const result = await modClient().moderations.create({
      model: "omni-moderation-latest",
      input: text,
    });
    const flagged = result.results.some((r) => r.flagged);
    const categories = result.results.flatMap((r) =>
      Object.entries(r.categories)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    );
    return { flagged, categories };
  } catch (err) {
    // Fail-open: don't block the demo if moderation is down. Log the error
    // so we know it's happening.
    return {
      flagged: false,
      categories: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ───────────────────────────────────────────────────────────────────────
// In-memory rate limit. Keyed by sessionId; resets every windowMs. Single
// instance only — on Vercel Fluid Compute multiple function instances will
// each have their own counter, so the effective limit is N × instances.
// For a demo that's plenty; production would use Upstash Redis.
// ───────────────────────────────────────────────────────────────────────
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 60; // 60 messages per hour per session

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

export function checkRateLimit(sessionId: string): RateLimitCheck {
  const now = Date.now();
  const existing = buckets.get(sessionId);
  if (!existing || existing.resetAt < now) {
    buckets.set(sessionId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_PER_WINDOW - 1, resetInMs: WINDOW_MS };
  }
  if (existing.count >= MAX_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetInMs: existing.resetAt - now };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_PER_WINDOW - existing.count,
    resetInMs: existing.resetAt - now,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Output checks — applied to the model's reply before it's returned to
// the user. Catches the model leaking the system prompt or echoing
// adversarial input verbatim.
// ───────────────────────────────────────────────────────────────────────
const LEAK_INDICATORS = [
  /## Available Products/i,        // our own system-prompt header
  /## Your Personality/i,
  /## Rules\s*\n1\./i,
  /You are a helpful AI shopping assistant for Hoodtopia/i,
  /## Shopper Profile:/i,
];

export function detectPromptLeak(response: string): boolean {
  return LEAK_INDICATORS.some((re) => re.test(response));
}

// ───────────────────────────────────────────────────────────────────────
// Persistence — log everything we flag so we can audit later. Best-effort:
// if the DB write fails we still let the request continue (logging is not
// load-bearing).
// ───────────────────────────────────────────────────────────────────────
export type SafetyEventKind =
  | "injection"
  | "moderation"
  | "rate-limit"
  | "leak"
  | "blocked-recommendation";

export async function logSafetyEvent(params: {
  sessionId: string;
  kind: SafetyEventKind;
  reasons: string[];
  /** First 1000 chars of the offending message, for triage. */
  excerpt: string;
  /** Did we still serve the request? (rate-limit / injection -> blocked,
   * moderation soft-fail -> served). */
  blocked: boolean;
}): Promise<void> {
  try {
    await db.insert(chatSafetyEvents).values({
      id: uuidv4(),
      sessionId: params.sessionId,
      kind: params.kind,
      reasons: JSON.stringify(params.reasons),
      excerpt: params.excerpt.slice(0, 1000),
      blocked: params.blocked,
    });
  } catch (err) {
    // Never let a safety-log failure block the response — just warn.
    console.warn("[guardrails] safety event log failed:", err);
  }
}

// ───────────────────────────────────────────────────────────────────────
// Top-level helper: run all input checks. Returns either an "allowed"
// result with the cleaned message, or a "blocked" result with a
// user-facing reply. Centralised so the tRPC handler stays small.
// ───────────────────────────────────────────────────────────────────────
export type GuardrailResult =
  | { allowed: true; userMessage: string }
  | { allowed: false; reply: string };

export async function runInputGuardrails(opts: {
  sessionId: string;
  userMessage: string;
}): Promise<GuardrailResult> {
  // Hard cap on length before doing anything else — prevents abuse and
  // saves us a moderation call on obvious garbage.
  if (opts.userMessage.length > 2000) {
    await logSafetyEvent({
      sessionId: opts.sessionId,
      kind: "injection",
      reasons: ["too-long"],
      excerpt: opts.userMessage,
      blocked: true,
    });
    return {
      allowed: false,
      reply: "Your message is too long. Please keep it under 2000 characters.",
    };
  }

  const rate = checkRateLimit(opts.sessionId);
  if (!rate.allowed) {
    await logSafetyEvent({
      sessionId: opts.sessionId,
      kind: "rate-limit",
      reasons: [`reset-in-${Math.ceil(rate.resetInMs / 1000)}s`],
      excerpt: opts.userMessage,
      blocked: true,
    });
    const minutes = Math.ceil(rate.resetInMs / 60_000);
    return {
      allowed: false,
      reply: `Whoa — slow down! You've hit the chat limit. Try again in ~${minutes} minute(s).`,
    };
  }

  const inj = detectPromptInjection(opts.userMessage);
  if (inj.flagged) {
    await logSafetyEvent({
      sessionId: opts.sessionId,
      kind: "injection",
      reasons: inj.reasons,
      excerpt: opts.userMessage,
      blocked: true,
    });
    return {
      allowed: false,
      reply:
        "I can only help with hoodie-related questions about Hoodtopia products. " +
        "Please rephrase your question about our catalog.",
    };
  }

  const mod = await moderateInput(opts.userMessage);
  if (mod.flagged) {
    await logSafetyEvent({
      sessionId: opts.sessionId,
      kind: "moderation",
      reasons: mod.categories,
      excerpt: opts.userMessage,
      blocked: true,
    });
    return {
      allowed: false,
      reply:
        "I can't help with that. Let's keep things friendly and focused on " +
        "finding you a great hoodie!",
    };
  }

  return { allowed: true, userMessage: opts.userMessage };
}
