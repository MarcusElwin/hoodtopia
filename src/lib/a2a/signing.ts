import { createECDH, hkdfSync } from "node:crypto";
import * as jose from "jose";
import type { AgentCard } from "@a2a-js/sdk";
import {
  generateAgentCardSignature,
  verifyAgentCardSignature,
  type AgentCardSignatureGenerator,
} from "@a2a-js/sdk";
import { a2aOrigin } from "./config";

/**
 * Agent card signing and verification.
 *
 * A2A v1.0 added JWS-signed agent cards: a signature over a JCS-canonicalised
 * card, so a client can check the card really was issued by the domain it
 * claims. Without it, "discovery" means trusting whatever JSON a URL happened
 * to return — which is fine until an agent is transacting on your behalf.
 *
 * Locally the demo signs with an ephemeral ES256 key generated at boot, so it
 * works with no configuration. A deployment that runs on more than one process
 * has to pin the key — either the key itself (`A2A_SIGNING_JWK`) or a secret to
 * derive it from (`A2A_SIGNING_SEED`) — because the card and the JWKS that
 * verifies it are served by whichever instance the request happened to land on.
 */

const ALG = "ES256";

/** Conventional public path, served via a rewrite. */
export const JWKS_PATH = "/.well-known/jwks.json";

/**
 * The route that actually implements it. Verification reads this rather than
 * the well-known path so a host's rewrite handling is never on the critical
 * path of a signature check.
 */
export const JWKS_ROUTE = "/a2a/jwks";

export interface SigningKey {
  privateKey: jose.CryptoKey | jose.KeyObject;
  publicJwk: jose.JWK;
  kid: string;
}

/**
 * Whether the deployment can serve more than one process.
 *
 * Not a detail the protocol cares about, but it decides whether an ephemeral
 * key is harmless or actively wrong: a key that only one instance knows is
 * unverifiable the moment a second instance answers the JWKS request.
 */
function multiInstance(): boolean {
  return process.env.VERCEL === "1";
}

/** A key every instance of this deployment will derive identically. */
function stableSeed(): string | undefined {
  return process.env.A2A_SIGNING_SEED || undefined;
}

/**
 * Signing is on unless explicitly disabled, or unless it could only produce
 * signatures nobody can check.
 *
 * The tempting fallback — sign with a per-process key anyway — is the worst of
 * the three options. A client fetches the card from one instance and the JWKS
 * from another, finds no key matching the card's `kid`, and correctly refuses
 * to transact. An honestly unsigned card at least says what it is, and the demo
 * page reports it as such.
 */
export function signingEnabled(): boolean {
  if (process.env.A2A_SIGNING === "off") return false;
  if (process.env.A2A_SIGNING_JWK || stableSeed()) return true;
  return !multiInstance();
}

/** Why cards are going out unsigned, for the demo page and the logs. */
export function signingDisabledReason(): string | undefined {
  if (signingEnabled()) return undefined;
  if (process.env.A2A_SIGNING === "off") return "A2A_SIGNING=off";
  return (
    "This deployment can run on several instances, and an ephemeral key would " +
    "only be verifiable on the one that minted it. Set A2A_SIGNING_SEED to any " +
    "secret string (or A2A_SIGNING_JWK to a full private JWK) to sign cards."
  );
}

/** Order of the P-256 curve, for reducing seed material to a valid scalar. */
const P256_ORDER = BigInt(
  "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
);
const ONE = BigInt(1);

/**
 * Derives a stable ES256 key from a secret.
 *
 * A seed is far easier to put in an environment variable than a JWK, and every
 * instance that holds the same seed derives the same key — which is the whole
 * requirement. HKDF gives 48 bytes so that reducing into [1, n-1] leaves no
 * measurable bias, and ECDH does the scalar multiplication that turns the
 * private scalar into the public point.
 *
 * The seed must be secret. Deriving from something public — a deployment id, a
 * commit sha — would make the cards consistent and the signatures worthless.
 */
function deriveJwk(seed: string): jose.JWK {
  const material = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(seed, "utf8"),
      Buffer.alloc(0),
      Buffer.from("a2a-agent-card-signing-v1", "utf8"),
      48
    )
  );

  const scalar =
    (BigInt(`0x${material.toString("hex")}`) % (P256_ORDER - ONE)) + ONE;
  const d = Buffer.from(scalar.toString(16).padStart(64, "0"), "hex");

  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(d);
  // Uncompressed point: 0x04 || X (32 bytes) || Y (32 bytes).
  const point = ecdh.getPublicKey();

  return {
    kty: "EC",
    crv: "P-256",
    d: d.toString("base64url"),
    x: point.subarray(1, 33).toString("base64url"),
    y: point.subarray(33, 65).toString("base64url"),
  };
}

async function createKey(): Promise<SigningKey> {
  const seed = stableSeed();
  const configured = process.env.A2A_SIGNING_JWK;

  if (configured || seed) {
    const jwk = configured
      ? (JSON.parse(configured) as jose.JWK)
      : deriveJwk(seed!);
    const privateKey = (await jose.importJWK(jwk, ALG)) as jose.CryptoKey;
    // Build the public half from an explicit allowlist of EC public
    // parameters. Omitting the private ones by name would silently leak any
    // parameter a future key type adds; naming what may be published cannot.
    const publicJwk: jose.JWK = {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
    };
    return {
      privateKey,
      publicJwk: { ...publicJwk, alg: ALG, use: "sig" },
      kid: jwk.kid ?? (await jose.calculateJwkThumbprint(publicJwk)),
    };
  }

  const { privateKey, publicKey } = await jose.generateKeyPair(ALG, {
    extractable: true,
  });
  const publicJwk = await jose.exportJWK(publicKey);
  const kid = await jose.calculateJwkThumbprint(publicJwk);
  return {
    privateKey,
    publicJwk: { ...publicJwk, alg: ALG, use: "sig", kid },
    kid,
  };
}

/**
 * One key per process. Pinned to `globalThis` so a hot reload does not rotate
 * the key mid-session and invalidate cards a client already verified.
 */
const globalForKey = globalThis as typeof globalThis & {
  __hoodtopiaA2ASigningKey?: Promise<SigningKey>;
};

export function signingKey(): Promise<SigningKey> {
  globalForKey.__hoodtopiaA2ASigningKey ??= createKey();
  return globalForKey.__hoodtopiaA2ASigningKey;
}

/** The JWKS a verifier fetches to resolve this origin's public key. */
export async function publicJwks(): Promise<{ keys: jose.JWK[] }> {
  if (!signingEnabled()) return { keys: [] };
  const { publicJwk, kid } = await signingKey();
  return { keys: [{ ...publicJwk, kid }] };
}

/** Signs a card on the way out of `getAgentCard()`. */
export async function cardSigner(): Promise<
  AgentCardSignatureGenerator | undefined
> {
  if (!signingEnabled()) return undefined;
  const { privateKey, kid } = await signingKey();
  return generateAgentCardSignature(privateKey, {
    alg: ALG,
    kid,
    typ: "JOSE",
  });
}

/**
 * Parses a response that must be JSON, and says something useful when it is
 * not.
 *
 * A platform that serves an HTML error or an interstitial for a path it did not
 * route surfaces as `Unexpected token '<'`, which tells you nothing about which
 * URL failed or why. Anything that fetches part of the mesh goes through here
 * so the message names the URL, the status and what actually came back.
 */
export async function readJson(
  response: Response,
  what: string
): Promise<unknown> {
  const type = response.headers.get("content-type") ?? "unknown";
  const body = await response.text();

  if (!type.includes("json")) {
    const looksLikeHtml = body.trimStart().startsWith("<");
    throw new Error(
      `${what} at ${response.url} returned ${response.status} as ${type}` +
        (looksLikeHtml
          ? " — an HTML page, not JSON. The URL is being handled by something other than the agent (a platform 404, or access protection in front of the deployment)."
          : `: ${body.slice(0, 120)}`)
    );
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${what} at ${response.url} returned malformed JSON.`);
  }
}

export type VerificationStatus = "verified" | "unsigned" | "invalid";

export interface VerificationResult {
  status: VerificationStatus;
  kid?: string;
  detail?: string;
}

/**
 * Verifies a card against the JWKS of the origin the card was fetched from.
 *
 * The key is deliberately NOT resolved from the signature's own `jku` header.
 * A card that names its own key location proves nothing — an attacker who can
 * serve you a card can serve you a matching key. The only thing worth trusting
 * is the origin you already decided to talk to, so that is what we ask.
 */
export async function verifyCard(
  card: AgentCard,
  cardUrl: string
): Promise<VerificationResult> {
  if (card.signatures.length === 0) {
    return { status: "unsigned", detail: "The card carries no signatures." };
  }

  const origin = new URL(cardUrl).origin;

  try {
    const verifier = verifyAgentCardSignature(async (kid) => {
      const { fetchJson } = await import("./mesh-fetch");
      const { keys } = (await fetchJson(
        new URL(JWKS_ROUTE, origin).toString(),
        "JWKS"
      )) as { keys: jose.JWK[] };
      const match = keys.find((k) => k.kid === kid);
      if (!match) throw new Error(`No key ${kid} published by ${origin}`);
      return match;
    });

    await verifier(card);
    return {
      status: "verified",
      kid: card.signatures[0]?.protected
        ? decodeKid(card.signatures[0].protected)
        : undefined,
    };
  } catch (error) {
    return {
      status: "invalid",
      detail: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

function decodeKid(protectedHeader: string): string | undefined {
  try {
    const json = Buffer.from(protectedHeader, "base64url").toString("utf8");
    return (JSON.parse(json) as { kid?: string }).kid;
  } catch {
    return undefined;
  }
}

/** The JWKS URL this deployment publishes. */
export function jwksUrl(): string {
  return `${a2aOrigin()}${JWKS_PATH}`;
}
