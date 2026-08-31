import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { a2aOrigin, rememberOrigin, resetObservedOrigin } from "./config";

/**
 * The origin an agent card advertises is load-bearing: every agent-to-agent
 * call resolves through it. Getting it from the wrong environment variable is
 * how a preview deployment ends up serving cards that point at a dead ngrok
 * tunnel and 404ing its own discovery.
 */
describe("a2aOrigin", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.A2A_PUBLIC_ORIGIN;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    resetObservedOrigin();
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses the host the request actually arrived on", () => {
    rememberOrigin(
      new Headers({ host: "preview-abc.vercel.app", "x-forwarded-proto": "https" })
    );
    expect(a2aOrigin()).toBe("https://preview-abc.vercel.app");
  });

  it("prefers the forwarded host, which is what the client saw", () => {
    rememberOrigin(
      new Headers({
        host: "internal-lb.local",
        "x-forwarded-host": "hoodtopia.example",
        "x-forwarded-proto": "https",
      })
    );
    expect(a2aOrigin()).toBe("https://hoodtopia.example");
  });

  it("does not force https on localhost", () => {
    rememberOrigin(new Headers({ host: "localhost:3005" }));
    expect(a2aOrigin()).toBe("http://localhost:3005");
  });

  it("ignores NEXT_PUBLIC_SITE_URL entirely", () => {
    // The dev-tunnel script rewrites this to an ngrok URL for Kustom
    // callbacks. It says where third parties reach the storefront, not where
    // these agents are reachable, and trusting it broke discovery on Vercel.
    process.env.NEXT_PUBLIC_SITE_URL = "https://stale-tunnel.ngrok-free.dev";
    rememberOrigin(new Headers({ host: "real-host.vercel.app" }));
    expect(a2aOrigin()).toBe("https://real-host.vercel.app");
  });

  it("lets an explicit override win over the observed host", () => {
    process.env.A2A_PUBLIC_ORIGIN = "https://pinned.example";
    rememberOrigin(new Headers({ host: "somewhere-else.vercel.app" }));
    expect(a2aOrigin()).toBe("https://pinned.example");
  });

  it("falls back to the Vercel deployment URL before anything else", () => {
    process.env.VERCEL_URL = "deployment-xyz.vercel.app";
    // No request seen yet — e.g. a build-time render.
    expect(a2aOrigin()).toBe("https://deployment-xyz.vercel.app");
  });

  it("ignores a request with no host header", () => {
    process.env.VERCEL_URL = "deployment-xyz.vercel.app";
    rememberOrigin(new Headers({ "x-forwarded-proto": "https" }));
    expect(a2aOrigin()).toBe("https://deployment-xyz.vercel.app");
  });
});
