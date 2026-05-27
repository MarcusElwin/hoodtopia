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
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
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
