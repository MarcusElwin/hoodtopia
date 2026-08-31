import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installMeshFetch } from "./test-harness";
import { runtimeFor } from "./agents";
import { agentCardUrl } from "./registry";
import { JWKS_ROUTE, publicJwks, verifyCard } from "./signing";
import { callAgent, resetClients, verificationResults } from "./client";

let teardown: () => void;

beforeEach(() => {
  teardown = installMeshFetch();
});

afterEach(() => teardown());

async function signedCard(id: "checkout" | "shipping" | "disputes") {
  return (await runtimeFor(id)).requestHandler.getAgentCard();
}

describe("agent card signing", () => {
  it("publishes a public key for the signatures it issues", async () => {
    const { keys } = await publicJwks();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ alg: "ES256", use: "sig" });
    // The private half must never leave the process.
    expect(keys[0]).not.toHaveProperty("d");
  });

  it("serves cards carrying a JWS signature", async () => {
    const card = await signedCard("checkout");
    expect(card.signatures).toHaveLength(1);
    const header = JSON.parse(
      Buffer.from(card.signatures[0]!.protected, "base64url").toString("utf8")
    );
    expect(header).toMatchObject({ alg: "ES256", typ: "JOSE" });
    expect(header.kid).toBeTruthy();
  });

  it("verifies a card against the origin's published keys", async () => {
    const card = await signedCard("shipping");
    const result = await verifyCard(card, agentCardUrl("shipping"));
    expect(result.status).toBe("verified");
  });

  it("rejects a card whose contents were altered after signing", async () => {
    const card = await signedCard("checkout");
    // A tampered endpoint is the attack that matters: it would redirect every
    // subsequent call to somewhere the domain owner never authorised.
    const tampered = {
      ...card,
      supportedInterfaces: [
        { ...card.supportedInterfaces[0]!, url: "https://evil.example/a2a" },
      ],
    };
    const result = await verifyCard(tampered, agentCardUrl("checkout"));
    expect(result.status).toBe("invalid");
  });

  it("rejects a card whose signature was replaced", async () => {
    const card = await signedCard("disputes");
    const forged = {
      ...card,
      signatures: [
        { ...card.signatures[0]!, signature: "AAAA" + card.signatures[0]!.signature.slice(4) },
      ],
    };
    expect((await verifyCard(forged, agentCardUrl("disputes"))).status).toBe(
      "invalid"
    );
  });

  it("reports an unsigned card as unsigned rather than valid", async () => {
    const card = await signedCard("checkout");
    const result = await verifyCard({ ...card, signatures: [] }, agentCardUrl("checkout"));
    expect(result.status).toBe("unsigned");
  });
});

describe("verify-before-transact", () => {
  it("records a verified card before the first call goes out", async () => {
    resetClients();
    await callAgent({
      from: "shopper",
      to: "shipping",
      skill: "quote_shipping",
      contextId: "ctx-verify",
      data: { country: "SE", orderAmountMinor: 1000 },
    });
    expect(verificationResults().shipping?.status).toBe("verified");
  });

  it("refuses to transact with an agent whose card will not verify", async () => {
    resetClients();
    const realFetch = globalThis.fetch;
    // Strip the origin's keys: the card is still signed, but nothing vouches
    // for it any more, which is exactly the case a verifier exists to catch.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(JWKS_ROUTE)) return Response.json({ keys: [] });
      return realFetch(input, init);
    }) as typeof fetch;

    await expect(
      callAgent({
        from: "shopper",
        to: "checkout",
        skill: "quote_cart",
        contextId: "ctx-refuse",
        data: {},
      })
    ).rejects.toThrow(/failed signature verification/);

    globalThis.fetch = realFetch;
    resetClients();
  });
});
