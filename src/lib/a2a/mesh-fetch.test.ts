import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { fetchJson, meshFetch } from "./mesh-fetch";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
});

describe("fetchJson diagnostics", () => {
  it("names the URL and what came back when a page is served instead of an agent", async () => {
    // What a platform 404 or an access wall actually returns. Parsed blind,
    // this is the useless "Unexpected token '<'".
    globalThis.fetch = vi.fn(async () =>
      new Response("<!DOCTYPE html><html><body>Not found</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    ) as typeof fetch;

    await expect(
      fetchJson("https://example.test/a2a/checkout/.well-known/agent-card.json", "Agent card")
    ).rejects.toThrow(/Agent card[\s\S]*an HTML page, not JSON/);
  });

  it("reports the status when the request itself failed", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!DOCTYPE html>", {
        status: 401,
        headers: { "content-type": "text/html" },
      })
    ) as typeof fetch;

    await expect(fetchJson("https://example.test/x", "Agent card")).rejects.toThrow(
      /failed: 401[\s\S]*access protection/
    );
  });

  it("returns parsed JSON on a normal response", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ name: "Checkout" })
    ) as typeof fetch;

    expect(await fetchJson("https://example.test/card", "Agent card")).toEqual({
      name: "Checkout",
    });
  });
});

describe("deployment protection bypass", () => {
  it("sends the bypass header when a secret is configured", async () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "s3cret";
    const spy: Mock<typeof fetch> = vi.fn(async () => Response.json({}));
    globalThis.fetch = spy as unknown as typeof fetch;

    await meshFetch("https://example.test/a2a/checkout");

    const headers = new Headers(spy.mock.calls[0]![1]?.headers);
    expect(headers.get("x-vercel-protection-bypass")).toBe("s3cret");
    expect(headers.get("x-vercel-set-bypass-cookie")).toBe("false");
  });

  it("sends nothing extra when no secret is configured", async () => {
    const spy: Mock<typeof fetch> = vi.fn(async () => Response.json({}));
    globalThis.fetch = spy as unknown as typeof fetch;

    await meshFetch("https://example.test/a2a/checkout");

    const headers = new Headers(spy.mock.calls[0]![1]?.headers);
    expect(headers.get("x-vercel-protection-bypass")).toBeNull();
  });
});
