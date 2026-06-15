import { NextResponse } from "next/server";
import { z } from "zod";
import {
  issueUpsellBearer,
  verifyUpsellDigest,
  upsellAuthEnabled,
} from "@/lib/kustom/upsell-auth";

// Force runtime execution — this route reads server-only secrets; Next would
// otherwise try to collect page data at build time and crash without env vars.
export const dynamic = "force-dynamic";

// Credential exchange for the authenticated upsell endpoint. A client proves it
// knows UPSELL_API_KEY by sending sha256(nonce + UPSELL_API_KEY); we return a
// short-lived bearer JWT to use against POST /api/upsell. Mirrors the Shipping
// Assistant auth handshake.
const bodySchema = z.object({
  identifier: z.string().min(1),
  secret: z.object({
    nonce: z.string().min(1),
    digest: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  if (!upsellAuthEnabled()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!verifyUpsellDigest(parsed.secret.nonce, parsed.secret.digest)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { token, expires_in } = await issueUpsellBearer(parsed.identifier);
  return NextResponse.json({ token, expires_in });
}
