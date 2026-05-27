import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "hoodtopia";
const AUDIENCE = "kustom-shipping-assistant";
const TOKEN_TTL_SECONDS = 3600;

function shippingKey(): string {
  const key = process.env.KUSTOM_SHIPPING_KEY;
  if (!key) {
    throw new Error("KUSTOM_SHIPPING_KEY is not set");
  }
  return key;
}

function jwtSecret(): Uint8Array {
  const secret = process.env.KUSTOM_SHIPPING_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "KUSTOM_SHIPPING_JWT_SECRET must be set and at least 32 chars"
    );
  }
  return new TextEncoder().encode(secret);
}

// Kustom Shipping Assistant authenticates by sending { nonce, digest } where
// digest = sha256(nonce + key). We compute the same and compare in constant time.
export function verifyDigest(nonce: string, digest: string): boolean {
  if (!nonce || !digest) return false;
  const expected = createHash("sha256")
    .update(nonce + shippingKey())
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(digest.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function issueBearer(identifier: string): Promise<{
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

export async function verifyBearer(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
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
