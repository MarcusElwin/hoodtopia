import { runtimeFor } from "@/lib/a2a/agents";
import { AGENT_IDS, agentCardUrl } from "@/lib/a2a/registry";

export const dynamic = "force-dynamic";

/** Every agent card in one response, for the demo page's discovery panel. */
export async function GET(): Promise<Response> {
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
