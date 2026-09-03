import { FIXTURE_CATALOG, matchProduct } from "./fixtures/catalog";
import { MARKETS } from "@/lib/kustom/markets";
import type { DemoAddress } from "./fixtures/store";

/**
 * Reading order details out of a sentence.
 *
 * A2A messages are natural language: a buyer's agent can perfectly well say
 * "two Kanji hoodies to London" and never send a structured part. Routing that
 * to the right skill is not enough — an agent that resolves the skill and then
 * quietly substitutes its own defaults for the *parameters* will hand back a
 * confirmable total for something nobody asked to buy.
 *
 * So this extracts what it can and, crucially, reports what it could not. The
 * caller is expected to ask rather than assume.
 */

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * Cities we can map to a market. Deliberately small and explicit: guessing a
 * destination wrong is worse than admitting we do not know it.
 */
const CITIES: Record<string, { city: string; country: string; postalCode: string }> = {
  stockholm: { city: "Stockholm", country: "SE", postalCode: "11136" },
  gothenburg: { city: "Gothenburg", country: "SE", postalCode: "41103" },
  london: { city: "London", country: "GB", postalCode: "EC1V 9HX" },
  manchester: { city: "Manchester", country: "GB", postalCode: "M1 1AE" },
  "new york": { city: "New York", country: "US", postalCode: "10013" },
  berlin: { city: "Berlin", country: "DE", postalCode: "10115" },
  munich: { city: "Munich", country: "DE", postalCode: "80331" },
  tokyo: { city: "Tokyo", country: "JP", postalCode: "1000001" },
};

const COUNTRY_NAMES: Record<string, string> = {
  sweden: "SE", swedish: "SE",
  "united kingdom": "GB", uk: "GB", britain: "GB", england: "GB",
  // "us" is deliberately absent: it is a pronoun far more often than a
  // market, and "please send us the hoodie" is not a US delivery. A standalone
  // "US" still resolves, via the bare-code rule below.
  "united states": "US", usa: "US", america: "US",
  germany: "DE", german: "DE",
  japan: "JP", japanese: "JP",
};

export interface ExtractedOrder {
  items: Array<{ sku: string; quantity: number }>;
  address?: DemoAddress;
  country?: string;
  /** What the text did not say. The agent should ask about these. */
  missing: Array<"product" | "destination">;
}

/** Quantity immediately preceding a product mention, else 1. */
function quantityNear(text: string, index: number): number {
  const before = text.slice(Math.max(0, index - 40), index).toLowerCase();
  const digits = [...before.matchAll(/(\d+)\s*(?:x\s*)?$/g)];
  if (digits.length > 0) return Math.min(99, Number(digits.at(-1)![1]));
  const words = [...before.matchAll(/\b([a-z]+)\b[\s,]*$/g)];
  const word = words.at(-1)?.[1];
  if (word && NUMBER_WORDS[word] !== undefined) return NUMBER_WORDS[word];
  return 1;
}

/** Every catalogue product the text names, with the quantity asked for. */
function extractItems(text: string): Array<{ sku: string; quantity: number }> {
  const lower = text.toLowerCase();
  const found = new Map<string, number>();

  for (const product of FIXTURE_CATALOG) {
    // Match on the distinguishing words of the name and colour, skipping the
    // ones every product shares ("hoodtopia", "hoodie").
    const terms = [product.sku, ...product.name.split(/\s+/), ...product.color.split(/\s+/)]
      .map((t) => t.toLowerCase())
      .filter((t) => t.length > 3 && !["hoodie", "hoodtopia"].includes(t));

    for (const term of terms) {
      const at = lower.indexOf(term);
      if (at === -1) continue;
      found.set(product.sku, Math.max(found.get(product.sku) ?? 0, quantityNear(text, at)));
      break;
    }
  }

  if (found.size === 0) {
    // One last loose pass, for phrasing the term scan missed.
    const loose = matchProduct(lower);
    if (loose) found.set(loose.sku, quantityNear(text, lower.indexOf(loose.color.toLowerCase())));
  }

  return [...found].map(([sku, quantity]) => ({ sku, quantity }));
}

/**
 * Words that carry no destination on their own, so a message made only of these
 * plus a market code still counts as naming that market.
 */
const FILLER = new Set([
  "please",
  "thanks",
  "thank",
  "you",
  "ship",
  "shipping",
  "send",
  "deliver",
  "delivery",
  "it",
  "to",
  "in",
  "for",
  "the",
  "a",
  "is",
  "im",
  "i",
  "am",
  "we",
  "my",
  "address",
  "country",
]);

/** A destination, only when the text actually names one. */
function extractDestination(text: string): { address?: DemoAddress; country?: string } {
  const lower = text.toLowerCase();

  for (const [needle, place] of Object.entries(CITIES)) {
    if (!lower.includes(needle)) continue;
    return {
      country: place.country,
      address: {
        name: "Demo Shopper",
        street: "",
        postalCode: place.postalCode,
        city: place.city,
        country: place.country,
      },
    };
  }

  for (const [needle, code] of Object.entries(COUNTRY_NAMES)) {
    if (new RegExp(`\\b${needle}\\b`).test(lower)) return { country: code };
  }

  // A bare ISO code introduced by a preposition, e.g. "ship to SE".
  const iso = lower.match(/\b(?:to|in|for)\s+([a-z]{2})\b/);
  if (iso && MARKETS[iso[1].toUpperCase()]) return { country: iso[1].toUpperCase() };

  // The answer to "we deliver to SE, GB, US, DE, JP" is very often just one of
  // them. Accepted only when the code is the whole message, filler aside: a
  // loose two-letter match would read "send us the hoodie" as a US delivery.
  const bare = lower
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER.has(word));
  if (bare.length === 1) {
    const code = bare[0]!.toUpperCase();
    if (MARKETS[code]) return { country: code };
  }

  return {};
}

export function extractOrder(text: string): ExtractedOrder {
  const items = extractItems(text);
  const { address, country } = extractDestination(text);

  const missing: ExtractedOrder["missing"] = [];
  if (items.length === 0) missing.push("product");
  if (!country) missing.push("destination");

  return { items, address, country, missing };
}

/** A short, human question naming exactly what is still needed. */
export function askFor(missing: ExtractedOrder["missing"]): string {
  const questions: string[] = [];
  if (missing.includes("product")) {
    questions.push(
      `which hoodie you want — we have ${FIXTURE_CATALOG.map((p) => `${p.name} (${p.color})`).join(", ")}`
    );
  }
  if (missing.includes("destination")) {
    questions.push(
      `where to ship it — we deliver to ${Object.keys(MARKETS).join(", ")}`
    );
  }
  return `I need to know ${questions.join(", and ")}.`;
}
