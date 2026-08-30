import { getMarket } from "@/lib/kustom/markets";
import { isLive } from "./config";
import { findProduct, matchProduct, type FixtureProduct } from "./fixtures/catalog";
import type { OrderLine } from "./fixtures/store";

/**
 * Line pricing for the checkout agent.
 *
 * In `fixtures` mode prices come from the in-repo catalogue. In `live` mode the
 * agent prices against the real Medusa catalogue the storefront uses, matching
 * on variant SKU, and falls back to fixtures if the backend is unreachable —
 * a demo that dies because Postgres is down teaches nobody anything.
 */

export interface RequestedLine {
  sku?: string;
  /** Free-text product reference, when a buyer agent did not send a SKU. */
  query?: string;
  quantity?: number;
}

export interface PricedCart {
  currency: string;
  market: string;
  lines: OrderLine[];
  subtotalMinor: number;
  /** `medusa` when live pricing was used, `fixtures` otherwise. */
  source: "medusa" | "fixtures";
  /** SKUs and queries that matched nothing. */
  unmatched: string[];
}

function fixtureLine(
  product: FixtureProduct,
  quantity: number,
  currency: string
): OrderLine {
  const unitMinor = product.priceMinor[currency] ?? product.priceMinor.USD ?? 0;
  return {
    sku: product.sku,
    name: `${product.name} — ${product.color} / ${product.size}`,
    quantity,
    unitMinor,
    lineMinor: unitMinor * quantity,
  };
}

async function medusaLines(
  requested: RequestedLine[],
  currency: string
): Promise<{ lines: OrderLine[]; unmatched: string[] } | undefined> {
  try {
    const { listProducts } = await import("@/lib/commerce/medusa-products");
    const products = await listProducts({ currencyCode: currency.toLowerCase() });
    if (products.length === 0) return undefined;

    const lines: OrderLine[] = [];
    const unmatched: string[] = [];

    for (const item of requested) {
      const quantity = Math.max(1, item.quantity ?? 1);
      const needle = (item.sku ?? item.query ?? "").toLowerCase();
      if (!needle) continue;

      let matched: { name: string; sku: string; price: number } | undefined;
      for (const product of products) {
        const variant =
          product.variants.find((v) => v.sku.toLowerCase() === needle) ??
          (product.name.toLowerCase().includes(needle)
            ? product.variants[0]
            : undefined);
        if (variant) {
          matched = {
            name: `${product.name} — ${variant.color} / ${variant.size}`,
            sku: variant.sku,
            price: product.basePrice,
          };
          break;
        }
      }

      if (!matched) {
        unmatched.push(item.sku ?? item.query ?? "");
        continue;
      }

      lines.push({
        sku: matched.sku,
        name: matched.name,
        quantity,
        unitMinor: matched.price,
        lineMinor: matched.price * quantity,
      });
    }

    return lines.length > 0 ? { lines, unmatched } : undefined;
  } catch {
    // Medusa unreachable or misconfigured — fall through to fixtures.
    return undefined;
  }
}

export async function priceCart(
  requested: RequestedLine[],
  country: string
): Promise<PricedCart> {
  const market = getMarket(country);
  const currency = market.purchase_currency;

  if (isLive()) {
    const live = await medusaLines(requested, currency);
    if (live) {
      return {
        currency,
        market: market.purchase_country,
        lines: live.lines,
        subtotalMinor: live.lines.reduce((sum, l) => sum + l.lineMinor, 0),
        source: "medusa",
        unmatched: live.unmatched,
      };
    }
  }

  const lines: OrderLine[] = [];
  const unmatched: string[] = [];

  for (const item of requested) {
    const quantity = Math.max(1, item.quantity ?? 1);
    const product =
      (item.sku ? findProduct(item.sku) : undefined) ??
      (item.query ? matchProduct(item.query) : undefined);

    if (!product) {
      unmatched.push(item.sku ?? item.query ?? "");
      continue;
    }
    lines.push(fixtureLine(product, quantity, currency));
  }

  return {
    currency,
    market: market.purchase_country,
    lines,
    subtotalMinor: lines.reduce((sum, l) => sum + l.lineMinor, 0),
    source: "fixtures",
    unmatched,
  };
}

/** Formats a minor-unit amount the way the destination market writes money. */
export function formatMinor(minor: number, currency: string): string {
  const zeroDecimal = currency === "JPY";
  const amount = zeroDecimal ? minor : minor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(amount);
}
