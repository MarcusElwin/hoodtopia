import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Kustom does NOT sign callback requests. We protect the routes by baking a
// shared-secret HMAC into the merchant_urls themselves as ?token=<sig>.
// Pattern: sig = HMAC_SHA256(KUSTOM_CALLBACK_SECRET, callbackKind).hex()
//
// The token is stable per route (not per order) — Kustom would otherwise
// need to invoke us through some opaque blob we can't influence. Acceptable
// for a demo, since exposure of the URL still only lets you POST a fake
// order and our handlers recompute totals deterministically.

export type CallbackKind =
  | "address"
  | "country"
  | "shipping_option"
  | "validation"
  | "upsell"
  | "upsell_validation";

function secret(): string {
  const s = process.env.KUSTOM_CALLBACK_SECRET;
  if (!s) {
    throw new Error(
      "KUSTOM_CALLBACK_SECRET is not set. openssl rand -hex 32 and add to .env.local"
    );
  }
  return s;
}

export function callbackToken(kind: CallbackKind): string {
  return createHmac("sha256", secret()).update(kind).digest("hex");
}

export function verifyCallbackToken(
  kind: CallbackKind,
  provided: string | null
): boolean {
  if (!provided) return false;
  const expected = callbackToken(kind);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(provided, "utf8")
  );
}
