// Thin wrapper around Vercel Web Analytics so call-sites stay framework-agnostic
// and we have one place to enforce event naming + types. Vercel auto-loads the
// client tracker from <Analytics /> in src/app/layout.tsx; this module just
// provides typed helpers for custom events fired from React.
//
// Server-side events (e.g. from API routes) should import @vercel/analytics/server
// directly — Vercel's docs recommend that path for App Router.

import { track as vercelTrack } from "@vercel/analytics";

/** Standardised property bag we attach to every commerce event. */
type EventProps = Record<string, string | number | boolean | null | undefined>;

/** Names locked here so misspellings show up at compile time. */
export type EventName =
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "purchase_completed"
  | "ai_recommendation_shown"
  | "ai_recommendation_clicked"
  | "upsell_offered"
  | "upsell_accepted"
  | "out_of_stock_blocked"
  | "stock_validation_failed";

export function track(event: EventName, props?: EventProps): void {
  // Vercel's track() is fire-and-forget; failures are silent on purpose so
  // analytics never breaks the UX.
  vercelTrack(event, sanitise(props));
}

// Vercel rejects nested objects + non-primitive values. Drop anything weird
// rather than blow up the event.
function sanitise(p?: EventProps): EventProps | undefined {
  if (!p) return undefined;
  const out: EventProps = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}
