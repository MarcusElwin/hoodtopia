import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

// Auth for the standalone REST upsell endpoint (`POST /api/upsell`).
//
// Unlike the Kustom confirmation-page callback — which Kustom invokes through a
// URL we register, so we bake an HMAC ?token= into that URL — the REST endpoint
// is called directly by our own clients / partners during upsell onboarding and
// testing. So it uses a proper bearer flow, mirroring the Shipping Assistant:
//
//   1. POST /api/upsell/auth  { identifier, secret: { nonce, digest } }
//        digest = sha256(nonce + UPSELL_API_KEY)            → { token, expires_in }
//   2. POST /api/upsell       Authorization: Bearer <token>
//
// Two secrets, same split as shipping-auth:
//   UPSELL_API_KEY        — shared credential the client hashes with a nonce
//   UPSELL_API_JWT_SECRET — server-only HS256 signing key (never leaves us)

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

export async function verifyUpsellBearer(
  authHeader: string | null
): Promise<boolean> {
  if (!authHeader) return false;
  // Fail closed when the signing secret isn't configured.
  if (!process.env.UPSELL_API_JWT_SECRET) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  try {
    await jwtVerify(match[1], jwtSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}
