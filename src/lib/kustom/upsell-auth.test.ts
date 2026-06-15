import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import {
  upsellAuthEnabled,
  verifyUpsellDigest,
  issueUpsellBearer,
  verifyUpsellBearer,
} from "./upsell-auth";

const KEY = "test-upsell-api-key";
const JWT_SECRET = "x".repeat(40); // >= 32 chars

describe("upsell-auth", () => {
  beforeEach(() => {
    process.env.UPSELL_API_KEY = KEY;
    process.env.UPSELL_API_JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    delete process.env.UPSELL_API_KEY;
    delete process.env.UPSELL_API_JWT_SECRET;
  });

  describe("upsellAuthEnabled", () => {
    it("is true when both secrets are set", () => {
      expect(upsellAuthEnabled()).toBe(true);
    });

    it("is false when the API key is missing", () => {
      delete process.env.UPSELL_API_KEY;
      expect(upsellAuthEnabled()).toBe(false);
    });

    it("is false when the JWT secret is too short", () => {
      process.env.UPSELL_API_JWT_SECRET = "short";
      expect(upsellAuthEnabled()).toBe(false);
    });
  });

  describe("verifyUpsellDigest", () => {
    const digestFor = (nonce: string) =>
      createHash("sha256").update(nonce + KEY).digest("hex");

    it("accepts a correct digest", () => {
      expect(verifyUpsellDigest("abc123", digestFor("abc123"))).toBe(true);
    });

    it("accepts an uppercased digest (compared case-insensitively)", () => {
      expect(
        verifyUpsellDigest("abc123", digestFor("abc123").toUpperCase())
      ).toBe(true);
    });

    it("rejects a wrong digest", () => {
      expect(verifyUpsellDigest("abc123", digestFor("different"))).toBe(false);
    });

    it("rejects empty input", () => {
      expect(verifyUpsellDigest("", "")).toBe(false);
    });

    it("fails closed when the API key is not set", () => {
      delete process.env.UPSELL_API_KEY;
      expect(verifyUpsellDigest("abc123", digestFor("abc123"))).toBe(false);
    });
  });

  describe("bearer round-trip", () => {
    it("issues a token that verifies", async () => {
      const { token, expires_in } = await issueUpsellBearer("client-1");
      expect(expires_in).toBe(3600);
      expect(await verifyUpsellBearer(`Bearer ${token}`)).toBe(true);
    });

    it("rejects a missing or malformed header", async () => {
      expect(await verifyUpsellBearer(null)).toBe(false);
      expect(await verifyUpsellBearer("not-a-bearer")).toBe(false);
    });

    it("rejects a garbage token", async () => {
      expect(await verifyUpsellBearer("Bearer not.a.jwt")).toBe(false);
    });

    it("rejects a token signed with a different secret", async () => {
      const { token } = await issueUpsellBearer("client-1");
      process.env.UPSELL_API_JWT_SECRET = "y".repeat(40);
      expect(await verifyUpsellBearer(`Bearer ${token}`)).toBe(false);
    });

    it("fails closed when the signing secret is not set", async () => {
      const { token } = await issueUpsellBearer("client-1");
      delete process.env.UPSELL_API_JWT_SECRET;
      expect(await verifyUpsellBearer(`Bearer ${token}`)).toBe(false);
    });
  });

  describe("static API key bearer", () => {
    it("accepts Bearer <UPSELL_API_KEY> directly", async () => {
      expect(await verifyUpsellBearer(`Bearer ${KEY}`)).toBe(true);
    });

    it("rejects a wrong key", async () => {
      expect(await verifyUpsellBearer("Bearer wrong-key")).toBe(false);
    });

    it("accepts the static key even without the JWT secret configured", async () => {
      delete process.env.UPSELL_API_JWT_SECRET;
      expect(await verifyUpsellBearer(`Bearer ${KEY}`)).toBe(true);
    });

    it("fails closed when the API key is not set", async () => {
      delete process.env.UPSELL_API_KEY;
      delete process.env.UPSELL_API_JWT_SECRET;
      expect(await verifyUpsellBearer(`Bearer ${KEY}`)).toBe(false);
    });
  });
});
