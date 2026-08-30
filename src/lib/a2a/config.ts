/**
 * Configuration for the A2A commerce mesh.
 *
 * The mesh runs in one of two modes:
 *
 *  - `fixtures` (default) — the agents answer from deterministic in-repo data
 *    and a scripted parcel clock. No Medusa backend, no Kustom credentials and
 *    no model API key required, so the demo is runnable straight after a clone.
 *  - `live` — the agents call the real Medusa/Kustom stack the storefront uses
 *    and route free-text through the configured LLM.
 *
 * Everything the agents do goes through the same skill implementations; only
 * the data source behind them changes.
 */
export type A2ADemoMode = "fixtures" | "live";

export function demoMode(): A2ADemoMode {
  return process.env.A2A_DEMO_MODE === "live" ? "live" : "fixtures";
}

export function isLive(): boolean {
  return demoMode() === "live";
}

/**
 * Absolute origin the agent cards advertise. A2A cards must carry absolute
 * URLs — a relative endpoint is not resolvable by a client that discovered the
 * card from somewhere else — so we derive one rather than emitting a path.
 */
export function a2aOrigin(): string {
  const explicit =
    process.env.A2A_PUBLIC_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3005}`;
}

/**
 * How fast the scripted parcel moves in fixtures mode. Real shipping takes
 * days; the demo compresses a delivery into a handful of seconds so the
 * long-running task is observable in a browser tab.
 */
export function parcelTickMs(): number {
  const raw = Number(process.env.A2A_PARCEL_TICK_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 1_500;
}
