import { traceBus } from "@/lib/a2a/trace";

export const dynamic = "force-dynamic";

/**
 * Server-sent stream of trace events for one context: the backlog first, then
 * every new hop as it happens. This is the demo's own telemetry, not part of
 * A2A — the protocol gives no participant a view of the whole mesh.
 */
export async function GET(request: Request): Promise<Response> {
  const contextId = new URL(request.url).searchParams.get("contextId");
  if (!contextId) {
    return Response.json({ error: "contextId is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      for (const event of traceBus.history(contextId)) send(event);

      const unsubscribe = traceBus.subscribe(contextId, send);

      // Proxies and platform gateways drop an idle SSE connection; a comment
      // frame every 15s keeps it open through a slow delivery.
      const keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          closed = true;
        }
      }, 15_000);

      const stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      };

      request.signal.addEventListener("abort", stop);
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
