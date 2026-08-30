import { publicJwks } from "@/lib/a2a/signing";

/**
 * Public keys for verifying this origin's agent cards. Reached at the standard
 * `/.well-known/jwks.json` via the rewrite in next.config.ts.
 *
 * A verifier resolves keys from the origin it decided to talk to, never from a
 * URL the card itself supplies — see `verifyCard` in src/lib/a2a/signing.ts.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(await publicJwks(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
