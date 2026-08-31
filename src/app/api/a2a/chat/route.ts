import { randomUUID } from "node:crypto";
import { callAgent } from "@/lib/a2a/client";
import { rateLimit } from "@/lib/a2a/http";
import { partsToText } from "@/lib/a2a/parts";
import { isAgentId } from "@/lib/a2a/registry";
import { stateSlug } from "@/lib/a2a/status";

export const dynamic = "force-dynamic";

/**
 * One conversational turn against one agent.
 *
 * Note what this route does *not* do: route. A2A has no front door — a buyer
 * picks a counterparty and talks to it. So the caller names the agent, exactly
 * as an outside buyer's agent would after reading the cards. Pretending
 * otherwise would hide the most important thing about the protocol.
 *
 * `taskId` continues an existing task, which is how a follow-up answer reaches
 * the agent that asked the question rather than starting a fresh request.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = rateLimit(request, "chat");
  if (limited) return limited;

  let body: { agent?: string; text?: string; contextId?: string; taskId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agent, text } = body;
  if (!agent || !isAgentId(agent)) {
    return Response.json({ error: `Unknown agent: ${agent ?? "(none)"}` }, { status: 400 });
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "A message is required" }, { status: 400 });
  }
  if (text.length > 2_000) {
    return Response.json({ error: "Message too long" }, { status: 413 });
  }

  const contextId = body.contextId ?? randomUUID();

  try {
    const result = await callAgent({
      from: "shopper",
      to: agent,
      contextId,
      taskId: body.taskId,
      text: text.trim(),
    });

    const isTask = "status" in result;
    const state = isTask ? stateSlug(result.status?.state) : "message";
    const reply = isTask
      ? partsToText(result.status?.message?.parts)
      : partsToText(result.parts);

    return Response.json({
      contextId,
      // Only carry the task forward while the agent is still waiting on the
      // buyer; a finished task must not absorb the next unrelated question.
      taskId:
        isTask && (state === "input-required" || state === "auth-required")
          ? result.id
          : undefined,
      state,
      reply: reply || "(no reply)",
    });
  } catch (error) {
    return Response.json(
      {
        contextId,
        state: "failed",
        reply: error instanceof Error ? error.message : "The agent could not be reached.",
      },
      { status: 502 }
    );
  }
}
