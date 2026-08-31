import { runtimeFor } from "@/lib/a2a/agents";
import { AGENT_IDS, agentCardUrl } from "@/lib/a2a/registry";
import { rememberOrigin } from "@/lib/a2a/config";

export const dynamic = "force-dynamic";

/** Every agent card in one response, for the demo page's discovery panel. */
export async function GET(request: Request): Promise<Response> {
  rememberOrigin(request.headers);

  return Response.json({
    agents: await Promise.all(
      AGENT_IDS.map(async (id) => ({
        id,
        cardUrl: agentCardUrl(id),
        card: await (await runtimeFor(id)).requestHandler.getAgentCard(),
      }))
    ),
  });
}
