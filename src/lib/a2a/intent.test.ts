import { describe, expect, it } from "vitest";
import { askFor, extractOrder } from "./intent";

describe("extractOrder", () => {
  it("reads product and quantity from a sentence", () => {
    const order = extractOrder("I would like to buy two Umai Kanji hoodies, ship to London");
    expect(order.items).toEqual([{ sku: "HT-KANJI-NAV-S", quantity: 2 }]);
    expect(order.country).toBe("GB");
    expect(order.missing).toEqual([]);
  });

  it.each([
    ["a Nebula Fade hoodie", 1],
    ["3 Nebula Fade hoodies", 3],
    ["three Nebula Fade hoodies", 3],
    ["2x Nebula Fade", 2],
  ])("reads the quantity in %j as %i", (text, quantity) => {
    const order = extractOrder(`${text} to Stockholm`);
    expect(order.items).toEqual([{ sku: "HT-NEBULA-PUR-L", quantity }]);
  });

  it("matches on colour as well as name", () => {
    expect(extractOrder("the navy one, to Berlin").items).toEqual([
      { sku: "HT-KANJI-NAV-S", quantity: 1 },
    ]);
  });

  it("picks up more than one product", () => {
    const order = extractOrder("a Classic hoodie and two Nebula Fade hoodies to Tokyo");
    expect(order.items).toEqual(
      expect.arrayContaining([
        { sku: "HT-CLASSIC-BLK-M", quantity: 1 },
        { sku: "HT-NEBULA-PUR-L", quantity: 2 },
      ])
    );
  });

  it.each([
    ["Stockholm", "SE"],
    ["London", "GB"],
    ["New York", "US"],
    ["Berlin", "DE"],
    ["Tokyo", "JP"],
    ["Sweden", "SE"],
    ["the UK", "GB"],
    ["Japan", "JP"],
  ])("resolves %j to %s", (place, code) => {
    expect(extractOrder(`a Classic hoodie to ${place}`).country).toBe(code);
  });

  it("reports a missing product rather than inventing one", () => {
    const order = extractOrder("Hey there, what do you sell?");
    expect(order.items).toEqual([]);
    expect(order.missing).toContain("product");
  });

  it("reports a missing destination rather than assuming one", () => {
    const order = extractOrder("How much for a Nebula Fade hoodie?");
    expect(order.items).toHaveLength(1);
    expect(order.missing).toEqual(["destination"]);
  });

  it("does not resolve a city it has no market for", () => {
    expect(extractOrder("a Classic hoodie to Reykjavik").country).toBeUndefined();
  });
});

describe("askFor", () => {
  it("names only what is actually missing", () => {
    const question = askFor(["destination"]);
    expect(question).toContain("where to ship");
    expect(question).not.toContain("which hoodie");
  });

  it("asks about both when both are missing", () => {
    const question = askFor(["product", "destination"]);
    expect(question).toContain("which hoodie");
    expect(question).toContain("where to ship");
  });
});
