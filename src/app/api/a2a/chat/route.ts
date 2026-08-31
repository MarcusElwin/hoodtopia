import { randomUUID } from "node:crypto";
import { callAgent } from "@/lib/a2a/client";
import { rateLimit } from "@/lib/a2a/http";
import { rememberOrigin } from "@/lib/a2a/config";
import { partsToText } from "@/lib/a2a/parts";
import { isAgentId } from "@/lib/a2a/registry";
import { stateSlug } from "@/lib/a2a/status";
import { traceBus } from "@/lib/a2a/trace";

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
  rememberOrigin(request.headers);

  const limited = rateLimit(request, "chat");
  if (limited) return limited;

  let body: {
    agent?: string;
    text?: string;
    contextId?: string;
    taskId?: string;
    referenceTaskId?: string;
  };
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

  // Trace events are returned with the reply rather than pushed over a
  // separate stream. The bus lives in this process, and on a serverless
  // platform the next request is a different process — a subscriber elsewhere
  // would sit watching a bus that nothing ever writes to.
  const seen = traceBus.history(contextId).length;

  try {
    const result = await callAgent({
      from: "shopper",
      to: agent,
      contextId,
      taskId: body.taskId,
      // When the previous task finished, the new one still references it, so
      // the agent can resolve "buy them" against what was just priced.
      referenceTaskIds:
        !body.taskId && body.referenceTaskId ? [body.referenceTaskId] : undefined,
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
      // Referenced by the next turn regardless of how this one ended.
      referenceTaskId: isTask ? result.id : undefined,
      state,
      reply: reply || "(no reply)",
      events: traceBus.history(contextId).slice(seen),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The agent could not be reached.";

    return Response.json(
      {
        contextId,
        state: "failed",
        reply: message,
        // A task the agent no longer knows about is not a failure the buyer
        // caused, and the client can recover from it by asking again in one
        // message. Flagged rather than left to the UI to pattern-match on an
        // error string.
        taskLost: forgotten(body.taskId, message),
        events: traceBus.history(contextId).slice(seen),
      },
      { status: 502 }
    );
  }
}

/**
 * Whether the agent lost the task this turn was continuing.
 *
 * Task state lives in the agent's process, and a serverless platform is free to
 * answer the next request from a different one. Nothing about that is A2A's
 * fault — the protocol assumes an agent remembers its own tasks — but the demo
 * runs on a platform that does not guarantee it, so the case is named instead
 * of shown to a shopper as a raw id.
 */
function forgotten(taskId: string | undefined, message: string): boolean {
  return Boolean(taskId) && /task not found/i.test(message);
}
