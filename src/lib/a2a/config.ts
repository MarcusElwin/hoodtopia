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
 * Origin observed on the most recent inbound request.
 *
 * Deliberately not `NEXT_PUBLIC_SITE_URL`: that means "where third parties
 * reach the storefront" — the dev tunnel script rewrites it to an ngrok URL for
 * Kustom callbacks — which is a different question from "where are these agents
 * reachable right now". Advertising the former on a Vercel deployment sends
 * every agent-to-agent call to a host that has no idea what an agent card is.
 *
 * The host the client actually used is the only answer that is always right, so
 * that is what the cards advertise. One deployment serves one host in practice,
 * so a module-scoped value is enough; an explicit `A2A_PUBLIC_ORIGIN` always
 * wins if you need to pin it.
 */
let observedOrigin: string | undefined;

/**
 * Forgets the observed origin, so resolution falls back to the environment.
 * Used by tests, and safe to call whenever the deployment's host legitimately
 * changes — runtimes are keyed by origin, so a rebuild follows.
 */
export function resetObservedOrigin(): void {
  observedOrigin = undefined;
}

/** Records the origin an inbound request arrived on. */
export function rememberOrigin(headers: Headers): void {
  if (process.env.A2A_PUBLIC_ORIGIN) return;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return;

  const proto =
    headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  observedOrigin = `${proto}://${host}`.replace(/\/$/, "");
}

/**
 * Absolute origin the agent cards advertise. A2A cards must carry absolute
 * URLs — a relative endpoint is not resolvable by a client that discovered the
 * card from somewhere else — so we derive one rather than emitting a path.
 */
export function a2aOrigin(): string {
  const explicit = process.env.A2A_PUBLIC_ORIGIN;
  if (explicit) return explicit.replace(/\/$/, "");
  if (observedOrigin) return observedOrigin;
  // Vercel's own deployment URL, which is at least this deployment.
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
