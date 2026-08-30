import { ServerCallContext, UnauthenticatedUser } from "@a2a-js/sdk/server";
import { runtimeFor } from "./agents";
import { isAgentId } from "./registry";
import { resetClients } from "./client";
import { resetDemoState } from "./fixtures/store";
import { JWKS_PATH, publicJwks } from "./signing";

/**
 * Routes the mesh's own HTTP calls into the in-process agent runtimes.
 *
 * The agents genuinely call each other over `fetch`, which is the behaviour
 * worth keeping in production and the thing that makes them a mesh. Standing up
 * a Next server for a unit test would be slow and flaky, so the tests swap in a
 * `fetch` that speaks the same JSON-RPC to the same handlers. The agent code
 * under test is unchanged and unaware.
 */

/** Set by `vitest.config.ts` before any module is imported. */
export const TEST_ORIGIN =
  process.env.A2A_PUBLIC_ORIGIN ?? "http://a2a.test";

function agentFromUrl(url: string): string | undefined {
  const match = new URL(url).pathname.match(/^\/a2a\/([^/]+)/);
  return match?.[1];
}

async function dispatch(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  // Public keys, so card verification resolves the same way it does over HTTP.
  if (new URL(url).pathname === JWKS_PATH) {
    return Response.json(await publicJwks());
  }

  const agent = agentFromUrl(url);
  if (!agent || !isAgentId(agent)) {
    return new Response("Not found", { status: 404 });
  }

  const runtime = await runtimeFor(agent);

  if (new URL(url).pathname.endsWith("/agent-card.json")) {
    // Signed, exactly as the route handler serves it.
    return Response.json(await runtime.requestHandler.getAgentCard());
  }

  const body = JSON.parse(String(init?.body ?? "{}"));
  const context = new ServerCallContext({
    user: new UnauthenticatedUser(),
    requestedVersion: "1.0",
  });

  const result = await runtime.jsonRpc.handle(body, context);

  if (typeof result === "object" && result !== null && Symbol.asyncIterator in result) {
    // Streaming responses come back as SSE, same as the route handler emits.
    const generator = result as AsyncGenerator<unknown>;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const event of generator) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  return Response.json(result);
}

/** Installs the stub and returns a teardown that restores the real `fetch`. */
export function installMeshFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = dispatch as typeof fetch;
  resetClients();
  resetDemoState();

  return () => {
    globalThis.fetch = original;
    resetClients();
    resetDemoState();
  };
}
