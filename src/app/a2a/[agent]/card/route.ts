import { runtimeFor } from "@/lib/a2a/agents";
import { agentCardResponse } from "@/lib/a2a/http";
import { isAgentId } from "@/lib/a2a/registry";
import { rememberOrigin } from "@/lib/a2a/config";

/**
 * Agent card. Reached at the spec's well-known path via the rewrite in
 * next.config.ts: /a2a/<id>/.well-known/agent-card.json. Next's App Router
 * will not route a path segment beginning with a dot, so the rewrite maps it
 * onto this route rather than nesting a `.well-known` directory.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agent: string }> }
): Promise<Response> {
  rememberOrigin(request.headers);

  const { agent } = await params;
  if (!isAgentId(agent)) {
    return Response.json({ error: `Unknown agent: ${agent}` }, { status: 404 });
  }
  return agentCardResponse(await runtimeFor(agent));
}
