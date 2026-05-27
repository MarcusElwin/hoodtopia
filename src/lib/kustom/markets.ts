// Per-country defaults for the Kustom Create Order payload.
// Currency / locale / VAT must all align with what the merchant has
// configured in Kustom Portal — see paymentMethodConfiguration for which
// countries our Playground MID supports (CH, GB, PL, US, SE, NO, DK, FI,
// DE, AT, NL, BE, FR, IT, ES, PT, IE, GR, JP, HK, SG, CA, NZ, ZA, CZ).
//
// Keep the keys in sync with the currency dropdown the customer can pick.

export interface MarketConfig {
  purchase_country: string; // ISO 3166-1 alpha-2
  purchase_currency: string; // ISO 4217
  locale: string; // BCP 47
  vat_rate_bp: number; // basis points (e.g. 2500 = 25%)
  vat_divisor: number; // 1 + vat_rate (e.g. 1.25 for 25% VAT)
  shipping_minor: {
    standard: number; // fallback shipping prices in the market's minor units
    express: number;
  };
}

export const MARKETS: Record<string, MarketConfig> = {
  SE: {
    purchase_country: "SE",
    purchase_currency: "SEK",
    locale: "sv-SE",
    vat_rate_bp: 2500,
    vat_divisor: 1.25,
    shipping_minor: { standard: 4900, express: 9900 }, // 49 / 99 kr
  },
  GB: {
    purchase_country: "GB",
    purchase_currency: "GBP",
    locale: "en-GB",
    vat_rate_bp: 2000,
    vat_divisor: 1.2,
    shipping_minor: { standard: 499, express: 999 }, // £4.99 / £9.99
  },
  US: {
    purchase_country: "US",
    purchase_currency: "USD",
    locale: "en-US",
    vat_rate_bp: 0,
    vat_divisor: 1, // no VAT line in the US
    shipping_minor: { standard: 599, express: 1299 }, // $5.99 / $12.99
  },
  DE: {
    purchase_country: "DE",
    purchase_currency: "EUR",
    locale: "de-DE",
    vat_rate_bp: 1900,
    vat_divisor: 1.19,
    shipping_minor: { standard: 499, express: 999 }, // €4.99 / €9.99
  },
  JP: {
    purchase_country: "JP",
    purchase_currency: "JPY",
    locale: "ja-JP",
    vat_rate_bp: 1000,
    vat_divisor: 1.1,
    shipping_minor: { standard: 600, express: 1500 }, // ¥600 / ¥1500 (JPY has no minor unit)
  },
};

// Fallback when the country code in the UI dropdown isn't in the Kustom
// merchant config (e.g. someone picked a country we don't sell to yet).
export const DEFAULT_MARKET_CODE = "SE";

export function getMarket(code?: string | null): MarketConfig {
  if (code && MARKETS[code]) return MARKETS[code];
  return MARKETS[DEFAULT_MARKET_CODE];
}
