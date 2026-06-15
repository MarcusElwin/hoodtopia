import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AdaptedProduct } from "@/lib/commerce/product-adapter";
import type { OrderLine } from "@/lib/kustom/types";

vi.mock("@/lib/commerce/medusa-products", () => ({
  listProducts: vi.fn(),
}));
vi.mock("@/services/ai", () => ({
  getCartRecommendations: vi.fn(),
}));

import { buildUpsell } from "./upsell";
import { listProducts } from "@/lib/commerce/medusa-products";
import { getCartRecommendations } from "@/services/ai";

const mockListProducts = vi.mocked(listProducts);
const mockGetRecs = vi.mocked(getCartRecommendations);

let seq = 0;
function product(
  over: Partial<AdaptedProduct> & { sku?: string; stock?: number } = {}
): AdaptedProduct {
  const id = over.id ?? `prod-${++seq}`;
  const sku = over.sku ?? `SKU-${id}`;
  const stock = over.stock ?? 5;
  return {
    id,
    name: over.name ?? `Product ${id}`,
    slug: over.slug ?? id,
    description: over.description ?? "desc",
    basePrice: over.basePrice ?? 1000,
    imageUrl: over.imageUrl ?? "/img.jpg",
    category: over.category ?? "accessory",
    featured: false,
    material: null,
    features: null,
    createdAt: new Date(0),
    variants: over.variants ?? [
      { id: `${id}-v1`, productId: id, color: "Black", colorHex: "#000", size: "M", stock, imageUrl: null, sku },
    ],
  } as AdaptedProduct;
}

function line(
  reference: string,
  type: OrderLine["type"] = "physical",
  tax_rate = 2000
): OrderLine {
  return {
    type,
    reference,
    name: reference,
    quantity: 1,
    unit_price: 1000,
    tax_rate,
    total_amount: 1000,
    total_tax_amount: 200,
  };
}

describe("buildUpsell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses AI recommendations when a cart SKU matches the catalog", async () => {
    const hoodie = product({ id: "hoodie", sku: "HOODIE-1" });
    const beanie = product({ id: "beanie", sku: "BEANIE-1", basePrice: 500 });
    mockListProducts.mockResolvedValue([hoodie, beanie]);
    mockGetRecs.mockResolvedValue({
      recommendations: [{ product: beanie }] as never,
      cartAnalysis: "x",
    });

    const r = await buildUpsell({ order_lines: [line("HOODIE-1")] });

    expect(r.source).toBe("ai");
    expect(r.empty).toBe(false);
    expect(r.upsell_lines.map((l) => l.reference)).toEqual(["BEANIE-1"]);
    expect(r.last_upsell_time).toBeDefined();
    expect(r.warnings).toEqual([]);
  });

  it("falls back to catalog picks when the AI engine throws", async () => {
    const hoodie = product({ id: "hoodie", sku: "HOODIE-1" });
    const beanie = product({ id: "beanie", sku: "BEANIE-1", basePrice: 500 });
    mockListProducts.mockResolvedValue([hoodie, beanie]);
    mockGetRecs.mockRejectedValue(new Error("GEMINI_API_KEY missing"));

    const r = await buildUpsell({ order_lines: [line("HOODIE-1")] });

    expect(r.source).toBe("fallback");
    expect(r.empty).toBe(false);
    // Cheapest in-stock product that wasn't purchased.
    expect(r.upsell_lines.map((l) => l.reference)).toEqual(["BEANIE-1"]);
    expect(r.warnings.join()).toMatch(/AI recommendation failed/);
  });

  it("falls back (and never calls AI) when cart SKUs are unknown", async () => {
    const hoodie = product({ id: "hoodie", sku: "HOODIE-1", basePrice: 1000 });
    const beanie = product({ id: "beanie", sku: "BEANIE-1", basePrice: 500 });
    mockListProducts.mockResolvedValue([hoodie, beanie]);

    const r = await buildUpsell({ order_lines: [line("SOME-FOREIGN-SKU")] });

    expect(mockGetRecs).not.toHaveBeenCalled();
    expect(r.source).toBe("fallback");
    // Sorted cheapest-first; nothing purchased so both qualify.
    expect(r.upsell_lines.map((l) => l.reference)).toEqual(["BEANIE-1", "HOODIE-1"]);
    expect(r.warnings.join()).toMatch(/did not.*match|matched the catalog|none of the/i);
  });

  it("still recommends for an empty cart", async () => {
    mockListProducts.mockResolvedValue([product({ sku: "A" }), product({ sku: "B" })]);

    const r = await buildUpsell({ order_lines: [] });

    expect(r.source).toBe("fallback");
    expect(r.upsell_lines.length).toBe(2);
    expect(r.warnings.join()).toMatch(/no physical\/digital order_lines/);
  });

  it("respects max_upsell_amount in the fallback", async () => {
    const cheap = product({ id: "cheap", sku: "CHEAP", basePrice: 500 });
    const pricey = product({ id: "pricey", sku: "PRICEY", basePrice: 9000 });
    mockListProducts.mockResolvedValue([cheap, pricey]);

    const r = await buildUpsell({ order_lines: [line("X")], max_upsell_amount: 600 });

    expect(r.upsell_lines.map((l) => l.reference)).toEqual(["CHEAP"]);
  });

  it("returns empty when the catalog lookup fails", async () => {
    mockListProducts.mockRejectedValue(new Error("medusa unreachable"));

    const r = await buildUpsell({ order_lines: [line("X")] });

    expect(r.empty).toBe(true);
    expect(r.source).toBe("none");
    expect(r.upsell_lines).toEqual([]);
    expect(r.warnings.join()).toMatch(/catalog lookup failed/);
  });

  it("honours upsell_possible=false", async () => {
    const r = await buildUpsell({ upsell_possible: false, order_lines: [line("X")] });

    expect(r.empty).toBe(true);
    expect(r.source).toBe("none");
    expect(mockListProducts).not.toHaveBeenCalled();
    expect(r.warnings.join()).toMatch(/upsell_possible=false/);
  });

  it("derives tax_rate / VAT from the order lines (SE = 25%)", async () => {
    const beanie = product({ id: "beanie", sku: "BEANIE-1", basePrice: 1000 });
    mockListProducts.mockResolvedValue([beanie]);

    // No matching cart SKU → fallback path; tax_rate comes from the SE line.
    const r = await buildUpsell({
      order_lines: [line("UNKNOWN", "physical", 2500)],
    });

    expect(r.upsell_lines[0].tax_rate).toBe(2500);
    // 1000 - 1000/1.25 = 200
    expect(r.upsell_lines[0].total_tax_amount).toBe(200);
  });

  it("derives a 0% tax_rate for US markets", async () => {
    const beanie = product({ id: "beanie", sku: "BEANIE-1", basePrice: 1000 });
    mockListProducts.mockResolvedValue([beanie]);

    const r = await buildUpsell({
      order_lines: [line("UNKNOWN", "physical", 0)],
    });

    expect(r.upsell_lines[0].tax_rate).toBe(0);
    expect(r.upsell_lines[0].total_tax_amount).toBe(0);
  });

  it("passes the purchase currency through to listProducts", async () => {
    mockListProducts.mockResolvedValue([product({ sku: "A" })]);

    await buildUpsell({ order_lines: [line("X")], purchase_currency: "SEK" });

    expect(mockListProducts).toHaveBeenCalledWith({ currencyCode: "SEK" });
  });

  it("tolerates a malformed (non-array) order_lines payload", async () => {
    mockListProducts.mockResolvedValue([product({ sku: "A" })]);

    // Simulate a malformed body reaching the shared engine.
    const r = await buildUpsell({
      order_lines: "not-an-array" as never,
    });

    expect(r.empty).toBe(false);
    expect(r.warnings.join()).toMatch(/order_lines was not an array/);
  });

  it("ignores non-object entries inside order_lines", async () => {
    mockListProducts.mockResolvedValue([product({ sku: "A" })]);

    const r = await buildUpsell({
      order_lines: [null, "x", line("X")] as never,
    });

    // Should not throw; the one valid line is processed.
    expect(r.empty).toBe(false);
  });

  it("returns empty when nothing is in stock", async () => {
    mockListProducts.mockResolvedValue([
      product({ sku: "A", stock: 0 }),
      product({ sku: "B", stock: 0 }),
    ]);

    const r = await buildUpsell({ order_lines: [line("X")] });

    expect(r.empty).toBe(true);
    expect(r.source).toBe("none");
    expect(r.warnings.join()).toMatch(/no in-stock, in-budget/);
  });
});
