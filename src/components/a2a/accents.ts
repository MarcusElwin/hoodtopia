export type AgentKey = "checkout" | "shipping" | "disputes" | "shopper";

/**
 * One colour per participant, used consistently by the gallery and the
 * timeline so a reader can follow a hop across the page by colour alone.
 */
export const AGENT_ACCENT: Record<
  AgentKey,
  { dot: string; text: string; border: string; label: string }
> = {
  shopper: {
    dot: "bg-slate-400",
    text: "text-slate-300",
    border: "border-slate-500/40",
    label: "Shopper agent",
  },
  checkout: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-500/40",
    label: "Checkout agent",
  },
  shipping: {
    dot: "bg-sky-400",
    text: "text-sky-300",
    border: "border-sky-500/40",
    label: "Shipping agent",
  },
  disputes: {
    dot: "bg-rose-400",
    text: "text-rose-300",
    border: "border-rose-500/40",
    label: "Claims agent",
  },
};

export function accentFor(name: string) {
  return AGENT_ACCENT[(name as AgentKey) in AGENT_ACCENT ? (name as AgentKey) : "shopper"];
}

/** Colour for a task state chip. */
export const STATE_STYLE: Record<string, string> = {
  submitted: "border-slate-500/40 text-slate-300",
  working: "border-sky-500/40 text-sky-300",
  "input-required": "border-amber-500/50 text-amber-300",
  "auth-required": "border-amber-500/50 text-amber-300",
  completed: "border-emerald-500/40 text-emerald-300",
  failed: "border-red-500/50 text-red-300",
  rejected: "border-red-500/50 text-red-300",
  canceled: "border-slate-500/40 text-slate-400",
};
