import { runtimeFor } from "@/lib/a2a/agents";
import { rememberOrigin } from "@/lib/a2a/config";
import { agentCardResponse } from "@/lib/a2a/http";
import { AGENT_CARD_TAIL, isAgentId } from "@/lib/a2a/registry";

/**
 * The agent card at the A2A well-known path.
 *
 * This is a real route rather than a rewrite onto one. Next's App Router will
 * not accept a literal directory named `.well-known`, and the obvious
 * workaround — rewriting the well-known URL onto a normal route — puts a
 * platform's routing layer on the critical path of every discovery. That is a
 * bad place for it: agent-to-agent calls all begin by fetching a card, so if a
 * host handles the rewrite differently the entire mesh stops working, and the
 * failure surfaces as a JSON parse error rather than anything diagnosable.
 *
 * A catch-all segment matches the same URL with no rewrite involved, because
 * the restriction is on literal path segments, not on captured ones.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agent: string; wellKnown: string[] }> }
): Promise<Response> {
  rememberOrigin(request.headers);

  const { agent, wellKnown } = await params;
  if (!isAgentId(agent)) {
    return Response.json({ error: `Unknown agent: ${agent}` }, { status: 404 });
  }
  if (wellKnown.join("/") !== AGENT_CARD_TAIL) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return agentCardResponse(await runtimeFor(agent));
}
