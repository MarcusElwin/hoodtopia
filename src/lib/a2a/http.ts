import { A2A_VERSION_HEADER, SSE_HEADERS, formatSSEEvent } from "@a2a-js/sdk";
import {
  ServerCallContext,
  UnauthenticatedUser,
  type RequestHeaders,
} from "@a2a-js/sdk/server";
import { checkRateLimit } from "@/lib/rate-limit";
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

/**
 * Per-IP limits for the A2A surface.
 *
 * These endpoints are public and unauthenticated by design, and in `live` mode
 * a single message can reach a paid model and the commerce backend. The limits
 * are deliberately generous enough for the demo's own scripted lifecycle
 * (roughly thirty calls in under a minute) while still capping a client that
 * decides to hold the endpoint open.
 */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

/**
 * Client address, taken the same way the tRPC layer takes it: prefer
 * `x-real-ip`, else the RIGHTMOST `x-forwarded-for` entry — the address seen
 * by the closest trusted proxy. The leftmost is client-supplied and trivially
 * spoofed to evade a per-IP limit.
 */
function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((v) => v.trim()).filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1]!;
  }
  return "unknown";
}

/** Applies the per-IP limit, returning a 429 response when exhausted. */
export function rateLimit(request: Request, bucket: string): Response | undefined {
  const { ok, resetAt } = checkRateLimit(
    `a2a:${bucket}:${clientIp(request)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (ok) return undefined;

  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return Response.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32029, message: "Rate limit exceeded" },
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

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

/**
 * The `id` of the request being answered.
 *
 * JSON-RPC requires an error response to echo the request id whenever it can
 * be determined; `null` is only correct when the request was unparseable or
 * carried no usable id. Returning `null` regardless leaves a batching client
 * unable to match the error to the call that caused it.
 */
function requestId(body: unknown): string | number | null {
  if (typeof body !== "object" || body === null) return null;
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? id : null;
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

/**
 * Serves the agent card.
 *
 * Read through `getAgentCard()` rather than off the runtime: that is where the
 * signature is applied, and serving `runtime.card` directly would publish an
 * unsigned card while every client was told to expect a signed one.
 */
export async function agentCardResponse(
  runtime: AgentRuntime
): Promise<Response> {
  return Response.json(await runtime.requestHandler.getAgentCard(), {
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
  const limited = rateLimit(request, runtime.id);
  if (limited) return limited;

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

  const id = requestId(body);

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
        id,
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
              id,
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
