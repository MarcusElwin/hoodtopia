import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

// Auth for the standalone REST upsell endpoint (`POST /api/upsell`).
//
// Unlike the Kustom confirmation-page callback — which Kustom invokes through a
// URL we register, so we bake an HMAC ?token= into that URL — the REST endpoint
// is called directly by our own clients / partners during upsell onboarding and
// testing. It accepts a Bearer token in one of two shapes:
//
//   A. Static key (simplest — for partners / portal onboarding):
//        POST /api/upsell   Authorization: Bearer <UPSELL_API_KEY>
//      One secret, one call. No handshake, no expiry. Rotate the key to revoke.
//
//   B. Handshake JWT (adds expiry + replay protection), mirroring the
//      Shipping Assistant:
//        1. POST /api/upsell/auth  { identifier, secret: { nonce, digest } }
//             digest = sha256(nonce + UPSELL_API_KEY)        → { token, expires_in }
//        2. POST /api/upsell       Authorization: Bearer <token>
//
// Two secrets, same split as shipping-auth:
//   UPSELL_API_KEY        — shared credential; usable directly (A) or hashed (B)
//   UPSELL_API_JWT_SECRET — server-only HS256 signing key (never leaves us)
//
// Only UPSELL_API_KEY is required for mode A. UPSELL_API_JWT_SECRET is only
// needed if you want the handshake/JWT flow (B) as well.

const ISSUER = "hoodtopia";
const AUDIENCE = "hoodtopia-upsell";
const TOKEN_TTL_SECONDS = 3600;

function apiKey(): string {
  const key = process.env.UPSELL_API_KEY;
  if (!key) {
    throw new Error("UPSELL_API_KEY is not set");
  }
  return key;
}

function jwtSecret(): Uint8Array {
  const secret = process.env.UPSELL_API_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "UPSELL_API_JWT_SECRET must be set and at least 32 chars"
    );
  }
  return new TextEncoder().encode(secret);
}

// Whether the bearer flow is configured. When either secret is missing the
// endpoints fail closed (401) instead of throwing a 500.
export function upsellAuthEnabled(): boolean {
  const s = process.env.UPSELL_API_JWT_SECRET;
  return Boolean(process.env.UPSELL_API_KEY) && Boolean(s) && s!.length >= 32;
}

// Credential exchange: client sends { nonce, digest } where
// digest = sha256(nonce + UPSELL_API_KEY). We recompute and compare in
// constant time.
export function verifyUpsellDigest(nonce: string, digest: string): boolean {
  if (!nonce || !digest) return false;
  if (!process.env.UPSELL_API_KEY) return false;
  const expected = createHash("sha256")
    .update(nonce + apiKey())
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(digest.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function issueUpsellBearer(identifier: string): Promise<{
  token: string;
  expires_in: number;
}> {
  const token = await new SignJWT({ sub: identifier })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(jwtSecret());
  return { token, expires_in: TOKEN_TTL_SECONDS };
}

// Constant-time string compare that doesn't leak length via early return.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still compare against a, so timing doesn't reveal the length mismatch.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Accepts EITHER auth shape:
//   1. Bearer <UPSELL_API_KEY>  — the static shared key, for partners/portal
//      onboarding who just want one secret + one call (no handshake).
//   2. Bearer <JWT>             — a short-lived token from POST /api/upsell/auth.
// The static key is the simpler path; the JWT path adds expiry + replay
// protection for callers that want it. Both gate the same read-only endpoint.
export async function verifyUpsellBearer(
  authHeader: string | null
): Promise<boolean> {
  if (!authHeader) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const presented = match[1];

  // 1. Static API key — constant-time compare against UPSELL_API_KEY.
  if (process.env.UPSELL_API_KEY && safeEqual(presented, apiKey())) {
    return true;
  }

  // 2. Handshake JWT — fail closed when the signing secret isn't configured.
  if (!process.env.UPSELL_API_JWT_SECRET) return false;
  try {
    await jwtVerify(presented, jwtSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}
