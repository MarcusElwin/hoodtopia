/**
 * A small deterministic catalogue for `fixtures` mode.
 *
 * In `live` mode the checkout agent prices against the real Medusa catalogue
 * instead; this exists so the mesh runs immediately after a clone, with no
 * database and no keys.
 */

export interface FixtureProduct {
  sku: string;
  name: string;
  color: string;
  size: string;
  /** Unit price in the minor units of each supported currency. */
  priceMinor: Record<string, number>;
}

export const FIXTURE_CATALOG: FixtureProduct[] = [
  {
    sku: "HT-CLASSIC-BLK-M",
    name: "Hoodtopia Classic Hoodie",
    color: "Black",
    size: "M",
    priceMinor: { SEK: 89900, GBP: 6900, USD: 8900, EUR: 7900, JPY: 13500 },
  },
  {
    sku: "HT-NEBULA-PUR-L",
    name: "Nebula Fade Hoodie",
    color: "Nebula Purple",
    size: "L",
    priceMinor: { SEK: 109900, GBP: 8500, USD: 10900, EUR: 9900, JPY: 16500 },
  },
  {
    sku: "HT-KANJI-NAV-S",
    name: "Umai Kanji Hoodie",
    color: "Navy",
    size: "S",
    priceMinor: { SEK: 99900, GBP: 7900, USD: 9900, EUR: 8900, JPY: 15000 },
  },
];

export function findProduct(sku: string): FixtureProduct | undefined {
  return FIXTURE_CATALOG.find(
    (p) => p.sku.toUpperCase() === sku.toUpperCase()
  );
}

/**
 * Loose lookup for free-text ordering ("the purple one", "kanji hoodie").
 * Deliberately simple: the point of the demo is the protocol, not retrieval.
 */
export function matchProduct(query: string): FixtureProduct | undefined {
  const q = query.toLowerCase();
  const exact = FIXTURE_CATALOG.find((p) => q.includes(p.sku.toLowerCase()));
  if (exact) return exact;
  return FIXTURE_CATALOG.find((p) => {
    const words = [p.name, p.color].join(" ").toLowerCase().split(/\s+/);
    return words.some((w) => w.length > 3 && q.includes(w));
  });
}
