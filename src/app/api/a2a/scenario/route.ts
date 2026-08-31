import { randomUUID } from "node:crypto";
import { runScenario, SCENARIOS, type ScenarioId } from "@/lib/a2a/scenario";
import { rateLimit } from "@/lib/a2a/http";
import { rememberOrigin } from "@/lib/a2a/config";
import { traceBus, type TraceEvent } from "@/lib/a2a/trace";
import { SCENARIO_COMPLETE } from "@/lib/a2a/markers";

export const dynamic = "force-dynamic";

/**
 * A lifecycle follows a parcel to the door, which takes longer than a default
 * function budget. The platform only keeps a function alive while it is doing
 * something, and an open response body counts.
 */
export const maxDuration = 60;

const IDS = new Set(SCENARIOS.map((s) => s.id));

/**
 * Runs a scripted lifecycle and streams every hop it makes.
 *
 * The run happens *inside* this request on purpose. The obvious shape — start
 * the scenario, return a `contextId`, let the browser subscribe to a trace
 * stream — works on one long-lived server and fails on a serverless platform
 * twice over: the run is killed the moment the response is sent, and the
 * subscriber lands on a different instance whose trace bus nothing is writing
 * to. Doing the work while the response is open fixes both, because the work
 * and the stream are the same invocation.
 */
export async function GET(request: Request): Promise<Response> {
  rememberOrigin(request.headers);

  // Each run drives ~30 agent calls, so the scenario runner gets a much
  // tighter limit than the A2A endpoints themselves.
  const limited = rateLimit(request, "scenario");
  if (limited) return limited;

  const scenario = new URL(request.url).searchParams.get("scenario") ?? "";
  if (!IDS.has(scenario as ScenarioId)) {
    return Response.json(
      { error: `Unknown scenario: ${scenario || "(none)"}` },
      { status: 400 }
    );
  }

  const contextId = randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (frame: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          closed = true;
        }
      };
      const send = (data: unknown) =>
        write(`data: ${JSON.stringify(data)}\n\n`);

      // Subscribed before the run starts, so nothing the first hop emits is
      // missed between the two.
      const unsubscribe = traceBus.subscribe(contextId, (event: TraceEvent) => {
        send(event);
      });

      // A tick with no traffic — a parcel between scans — must not look like a
      // dropped connection to a proxy in the middle.
      const keepAlive = setInterval(() => write(": keep-alive\n\n"), 15_000);

      const finish = () => {
        clearInterval(keepAlive);
        unsubscribe();
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The client disconnected first.
        }
      };

      request.signal.addEventListener("abort", finish);

      void runScenario(scenario as ScenarioId, contextId)
        .catch((error: unknown) => {
          send({
            id: `run-${contextId}`,
            seq: Number.MAX_SAFE_INTEGER,
            ts: new Date().toISOString(),
            contextId,
            kind: "error",
            from: "shopper",
            to: "shopper",
            summary:
              error instanceof Error ? error.message : "The scenario failed.",
          } satisfies TraceEvent);
        })
        .finally(() => {
          // The runner records this marker itself on a clean finish; repeating
          // it here means a failed run also releases the button.
          send({
            id: `done-${contextId}`,
            seq: Number.MAX_SAFE_INTEGER,
            ts: new Date().toISOString(),
            contextId,
            kind: "status",
            from: "shopper",
            to: "shopper",
            summary: SCENARIO_COMPLETE,
          } satisfies TraceEvent);
          finish();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
