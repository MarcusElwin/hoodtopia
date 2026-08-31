import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMeshFetch } from "./test-harness";
import { runtimeFor } from "./agents";
import { TRACE_KEY } from "./registry";
import { dispatchJsonRpc } from "./http";
import { traceBus, type TraceEvent } from "./trace";
import { ServerCallContext, UnauthenticatedUser } from "@a2a-js/sdk/server";

/**
 * The demo is written as if the three agents were three deployments, and on a
 * serverless platform they effectively are: each request may be answered by a
 * different process, with its own trace bus, task store and signing key. These
 * cover the pieces that had to stop assuming one process.
 */

let teardown: () => void;

beforeEach(() => {
  teardown = installMeshFetch();
});

afterEach(() => teardown());

function event(id: string, contextId: string, ts: string): TraceEvent {
  return {
    id,
    seq: 1,
    ts,
    contextId,
    kind: "status",
    from: "checkout",
    to: "shipping",
    summary: `hop ${id}`,
  };
}

describe("adopting a peer's trace", () => {
  it("keeps foreign events whole and in time order", () => {
    const contextId = `ctx-${Math.random()}`;
    traceBus.record({
      contextId,
      kind: "request",
      from: "shopper",
      to: "checkout",
      summary: "local",
    });

    // A peer instance numbers from its own counter, so its ids collide with
    // ours by sequence and never by identity.
    const added = traceBus.merge([
      event("peer-1", contextId, "2020-01-01T00:00:00.000Z"),
      event("peer-2", contextId, "2020-01-01T00:00:01.000Z"),
    ]);

    expect(added).toHaveLength(2);
    const history = traceBus.history(contextId);
    expect(history.map((e) => e.id)).toEqual(["peer-1", "peer-2", expect.any(String)]);
    expect(history[0]!.ts).toBe("2020-01-01T00:00:00.000Z");
  });

  it("ignores an event it has already seen", () => {
    const contextId = `ctx-${Math.random()}`;
    const hop = event("peer-1", contextId, "2020-01-01T00:00:00.000Z");

    expect(traceBus.merge([hop])).toHaveLength(1);
    expect(traceBus.merge([hop])).toHaveLength(0);
    expect(traceBus.history(contextId)).toHaveLength(1);
  });
});

describe("an agent's response", () => {
  it("carries the hops it made, so the caller can show them", async () => {
    const runtime = await runtimeFor("checkout");
    const contextId = `ctx-${Math.random()}`;

    const response = (await dispatchJsonRpc(
      runtime,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "SendMessage",
        params: {
          message: {
            messageId: "m1",
            role: "ROLE_USER",
            contextId,
            parts: [
              {
                text: "Buy one Umai Kanji hoodie, ship to Stockholm, Sweden",
                mediaType: "text/plain",
              },
            ],
            metadata: { "hoodtopia.dev/caller": "shopper" },
          },
        },
      },
      new ServerCallContext({
        user: new UnauthenticatedUser(),
        requestedVersion: "1.0",
      })
    )) as { result?: { task?: { metadata?: Record<string, unknown> } } };

    const carried = response.result?.task?.metadata?.[TRACE_KEY] as
      | TraceEvent[]
      | undefined;

    expect(carried).toBeDefined();
    // Pricing a cart means asking the shipping agent, and that hop is the one
    // the buyer's own process could never observe on its own.
    expect(carried!.some((e) => e.to === "shipping")).toBe(true);
    expect(carried!.every((e) => e.contextId === contextId)).toBe(true);
  });
});

/** A fresh signing module, with the process-wide key cache cleared. */
async function signingWith(env: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  delete (globalThis as { __hoodtopiaA2ASigningKey?: unknown })
    .__hoodtopiaA2ASigningKey;
  vi.resetModules();
  const signing = await import("./signing");

  return {
    signing,
    restore() {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      delete (globalThis as { __hoodtopiaA2ASigningKey?: unknown })
        .__hoodtopiaA2ASigningKey;
      vi.resetModules();
    },
  };
}

describe("a signing key several instances have to agree on", () => {
  it("derives the same key from the same secret", async () => {
    const first = await signingWith({
      A2A_SIGNING_SEED: "a-shared-secret",
      A2A_SIGNING_JWK: undefined,
    });
    const a = await first.signing.publicJwks();
    first.restore();

    const second = await signingWith({
      A2A_SIGNING_SEED: "a-shared-secret",
      A2A_SIGNING_JWK: undefined,
    });
    const b = await second.signing.publicJwks();
    second.restore();

    expect(a.keys[0]).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256" });
    // Same key, so a card signed by one instance verifies against another's
    // JWKS — which is the entire reason the seed exists.
    expect(b.keys[0]).toEqual(a.keys[0]);
    expect(a.keys[0]).not.toHaveProperty("d");
  });

  it("derives a private half that matches the public half it publishes", async () => {
    const jose = await import("jose");
    const derived = await signingWith({
      A2A_SIGNING_SEED: "a-shared-secret",
      A2A_SIGNING_JWK: undefined,
    });

    const { privateKey } = await derived.signing.signingKey();
    const published = (await derived.signing.publicJwks()).keys[0]!;
    derived.restore();

    // The public point is computed from the scalar rather than carried
    // alongside it, so a signature is the only thing that proves they agree.
    const jws = await new jose.CompactSign(
      new TextEncoder().encode("agent card")
    )
      .setProtectedHeader({ alg: "ES256" })
      .sign(privateKey);

    const verified = await jose.compactVerify(
      jws,
      await jose.importJWK(published, "ES256")
    );
    expect(new TextDecoder().decode(verified.payload)).toBe("agent card");
  });

  it("derives a different key from a different secret", async () => {
    const first = await signingWith({
      A2A_SIGNING_SEED: "one-secret",
      A2A_SIGNING_JWK: undefined,
    });
    const a = await first.signing.publicJwks();
    first.restore();

    const second = await signingWith({
      A2A_SIGNING_SEED: "another-secret",
      A2A_SIGNING_JWK: undefined,
    });
    const b = await second.signing.publicJwks();
    second.restore();

    expect(b.keys[0]!.x).not.toEqual(a.keys[0]!.x);
  });

  it("would rather serve an unsigned card than an unverifiable one", async () => {
    const platform = await signingWith({
      VERCEL: "1",
      A2A_SIGNING_SEED: undefined,
      A2A_SIGNING_JWK: undefined,
      A2A_SIGNING: undefined,
    });

    expect(platform.signing.signingEnabled()).toBe(false);
    expect(platform.signing.signingDisabledReason()).toMatch(/A2A_SIGNING_SEED/);
    expect((await platform.signing.publicJwks()).keys).toHaveLength(0);

    platform.restore();
  });

  it("signs on a platform that can hold one process", async () => {
    const single = await signingWith({
      VERCEL: undefined,
      A2A_SIGNING_SEED: undefined,
      A2A_SIGNING_JWK: undefined,
      A2A_SIGNING: undefined,
    });

    expect(single.signing.signingEnabled()).toBe(true);
    expect(single.signing.signingDisabledReason()).toBeUndefined();

    single.restore();
  });
});
