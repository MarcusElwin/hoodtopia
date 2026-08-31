import { readJson } from "./signing";

/**
 * The `fetch` every outbound mesh call goes through.
 *
 * Two jobs, both learned the hard way from a deployment that looked fine in the
 * browser and failed server-side.
 *
 * **Deployment protection.** An agent calling a peer on its own deployment goes
 * out through the public edge and back, so anything guarding that edge sees an
 * anonymous request. Vercel's Deployment Protection answers those with an HTML
 * challenge instead of the agent's JSON. When a bypass secret is configured we
 * send it, which is exactly what that secret is for.
 *
 * **Legibility.** Without this, a guarded or misrouted URL surfaces as
 * `Unexpected token '<'` — a JSON parser complaining about HTML it was never
 * meant to see, naming neither the URL nor the status.
 */
export function meshFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypass) return fetch(input, init);

  const headers = new Headers(init?.headers);
  headers.set("x-vercel-protection-bypass", bypass);
  // Ask the edge not to set a bypass cookie; these calls are one-shot.
  headers.set("x-vercel-set-bypass-cookie", "false");
  return fetch(input, { ...init, headers });
}

/** Fetches a URL that must return JSON, with a diagnosable failure. */
export async function fetchJson(
  url: string,
  what: string,
  init?: RequestInit
): Promise<unknown> {
  const response = await meshFetch(url, init);
  if (!response.ok) {
    // Read the body for the same reason: a bare status hides an auth wall.
    const type = response.headers.get("content-type") ?? "unknown";
    const body = await response.text();
    throw new Error(
      `${what} at ${url} failed: ${response.status}` +
        (body.trimStart().startsWith("<")
          ? ` (an HTML page, not the agent — likely a platform 404 or access protection in front of the deployment)`
          : type.includes("json")
            ? ` ${body.slice(0, 160)}`
            : "")
    );
  }
  return readJson(response, what);
}
