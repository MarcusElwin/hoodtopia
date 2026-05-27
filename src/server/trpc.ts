import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { checkRateLimit } from "@/lib/rate-limit";

// Create tRPC context
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    headers: opts.headers,
  };
};

// Initialize tRPC
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

function clientIp(headers: Headers): string {
  // Prefer x-real-ip (Vercel sets it to the real client IP). For
  // x-forwarded-for, take the RIGHTMOST entry — the address seen by the
  // closest trusted proxy — not the leftmost, which a client can spoof by
  // prepending a fake value ("1.2.3.4, <realip>") to evade per-IP limits.
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const ips = xff.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1]!;
  }
  return "unknown";
}

// Per-IP rate limit middleware. Applied to the unauthenticated procedures that
// call paid LLM / image-generation APIs so a single client can't run up cost
// or exhaust quota. Buckets are namespaced so endpoints with different cost
// profiles get independent limits.
export function rateLimit(opts: {
  name: string;
  limit: number;
  windowMs: number;
}) {
  return t.middleware(async ({ ctx, next }) => {
    const ip = clientIp(ctx.headers);
    const { ok } = checkRateLimit(`${opts.name}:${ip}`, opts.limit, opts.windowMs);
    if (!ok) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests — please slow down and try again shortly.",
      });
    }
    return next();
  });
}
