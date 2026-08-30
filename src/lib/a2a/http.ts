import { A2A_VERSION_HEADER, SSE_HEADERS, formatSSEEvent } from "@a2a-js/sdk";
import {
  ServerCallContext,
  UnauthenticatedUser,
  type RequestHeaders,
} from "@a2a-js/sdk/server";
import type { AgentRuntime } from "./runtime";

/**
 * Next.js App Router adapter for an A2A agent.
 *
 * Two endpoints per agent:
 *   GET  /a2a/<id>/.well-known/agent-card.json  — discovery
 *   POST /a2a/<id>                              — JSON-RPC, streaming or not
 *
 * The JSON-RPC handler returns an async generator for streaming methods
 * (`message/stream`, `tasks/resubscribe`) and a plain response object for
 * everything else, so the adapter's only real job is choosing between an SSE
 * body and a JSON body.
 */

function callContext(request: Request): ServerCallContext {
  const headers: RequestHeaders = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return new ServerCallContext({
    user: new UnauthenticatedUser(),
    requestedVersion: request.headers.get(A2A_VERSION_HEADER) ?? undefined,
    state: new Map<string, unknown>([["headers", headers]]),
  });
}

function isAsyncGenerator(
  value: unknown
): value is AsyncGenerator<unknown, void, undefined> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in (value as object)
  );
}

/** Serves the agent card. */
export function agentCardResponse(runtime: AgentRuntime): Response {
  return Response.json(runtime.card, {
    headers: {
      // Cards are stable between deploys but not immutable; a short cache keeps
      // repeat discovery cheap without pinning a stale endpoint URL.
      "Cache-Control": "public, max-age=60",
    },
  });
}

/** Handles one JSON-RPC request against an agent. */
export async function handleJsonRpc(
  runtime: AgentRuntime,
  request: Request
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 }
    );
  }

  const context = callContext(request);

  let result: unknown;
  try {
    result = await runtime.jsonRpc.handle(
      body as Record<string, unknown>,
      context
    );
  } catch (error) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      },
      { status: 500 }
    );
  }

  if (!isAsyncGenerator(result)) {
    return Response.json(result);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of result) {
          controller.enqueue(encoder.encode(formatSSEEvent(event)));
        }
      } catch (error) {
        // The stream has already started, so the error can only be reported
        // in-band. Emitting it as a JSON-RPC error frame keeps the client's
        // parser happy instead of leaving it on a truncated stream.
        controller.enqueue(
          encoder.encode(
            formatSSEEvent({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32603,
                message:
                  error instanceof Error ? error.message : "Stream failed",
              },
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
