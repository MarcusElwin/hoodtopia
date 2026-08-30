import { runtimeFor } from "@/lib/a2a/agents";
import { handleJsonRpc } from "@/lib/a2a/http";
import { isAgentId } from "@/lib/a2a/registry";

/**
 * JSON-RPC endpoint for one agent: POST /a2a/<checkout|shipping|disputes>.
 *
 * Streaming methods respond with SSE, so this route must not be statically
 * optimised or buffered.
 */
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agent: string }> }
): Promise<Response> {
  const { agent } = await params;
  if (!isAgentId(agent)) {
    return Response.json({ error: `Unknown agent: ${agent}` }, { status: 404 });
  }
  return handleJsonRpc(runtimeFor(agent), request);
}
