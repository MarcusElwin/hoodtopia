import { NextResponse } from "next/server";
import { z } from "zod";
import { issueBearer, verifyDigest } from "@/lib/kustom/shipping-auth";

const bodySchema = z.object({
  identifier: z.string().min(1),
  secret: z.object({
    nonce: z.string().min(1),
    digest: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!verifyDigest(parsed.secret.nonce, parsed.secret.digest)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { token, expires_in } = await issueBearer(parsed.identifier);
  return NextResponse.json({ token, expires_in });
}
