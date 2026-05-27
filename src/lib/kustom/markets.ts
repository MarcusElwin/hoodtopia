// Per-country defaults for the Kustom Create Order payload.
// Currency / locale / VAT must all align with what the merchant has
// configured in Kustom Portal — see paymentMethodConfiguration for which
// countries our Playground MID supports (CH, GB, PL, US, SE, NO, DK, FI,
// DE, AT, NL, BE, FR, IT, ES, PT, IE, GR, JP, HK, SG, CA, NZ, ZA, CZ).
//
// Keep the keys in sync with the currency dropdown the customer can pick.

export interface CarrierConfig {
  /** Free-form vendor id used in the KSA shipping_option.carrier field. */
  carrier: string;
  /** Marketing name shown in the iframe (e.g. "PostNord Standard"). */
  name: string;
  /**
   * Tracking-id format string. {RAND12} is replaced with a 12-char hex
   * fragment so tracking ids look like the carrier's real ones (PostNord
   * uses a 13-digit, Royal Mail uses XX123456789GB, etc — these are
   * close-enough approximations for a demo).
   */
  tracking_format: string;
}

export interface MarketConfig {
  purchase_country: string; // ISO 3166-1 alpha-2
  purchase_currency: string; // ISO 4217
  locale: string; // BCP 47
  vat_rate_bp: number; // basis points (e.g. 2500 = 25%)
  vat_divisor: number; // 1 + vat_rate (e.g. 1.25 for 25% VAT)
  shipping_minor: {
    standard: number; // minor units (öre / pence / cents / ¥)
    express: number;
    pickup: number;
    /** Free Standard kicks in when order_amount (minor units) >= this. */
    free_standard_threshold: number;
    /** Human-friendly amount used in the "free over X" label. */
    free_label: string;
  };
  /**
   * Real carriers serving this market. Still stubbed (we don't actually
   * call PostNord/DHL APIs) but using real names + plausible tracking IDs
   * makes the checkout demo indistinguishable from a real integration.
   */
  carriers: {
    standard: CarrierConfig;
    express: CarrierConfig;
    pickup: CarrierConfig;
  };
}

export const MARKETS: Record<string, MarketConfig> = {
  SE: {
    purchase_country: "SE",
    purchase_currency: "SEK",
    locale: "sv-SE",
    vat_rate_bp: 2500,
    vat_divisor: 1.25,
    shipping_minor: {
      standard: 4900,
      express: 9900,
      pickup: 2900,
      free_standard_threshold: 100000, // 1000 kr
      free_label: "1000 kr",
    },
    carriers: {
      // PostNord is the SE postal default; Klarna Logistics for express (also
      // signals the full Klarna stack — Klarna owns Kustom); Instabox parcel
      // lockers blanket Sweden.
      standard: {
        carrier: "postnord",
        name: "PostNord Standard",
        tracking_format: "{RAND12}SE",
      },
      express: {
        carrier: "klarna-logistics",
        name: "Klarna Logistics Next-Day",
        tracking_format: "KL-{RAND12}",
      },
      pickup: {
        carrier: "instabox",
        name: "Instabox parcel locker",
        tracking_format: "IB{RAND12}",
      },
    },
  },
  GB: {
    purchase_country: "GB",
    purchase_currency: "GBP",
    locale: "en-GB",
    vat_rate_bp: 2000,
    vat_divisor: 1.2,
    shipping_minor: {
      standard: 499,
      express: 999,
      pickup: 299,
      free_standard_threshold: 10000, // £100
      free_label: "£100",
    },
    carriers: {
      // Royal Mail = postal default. DPD = premium next-day. Evri operates
      // ParcelShop pickup points across the UK.
      standard: {
        carrier: "royal-mail",
        name: "Royal Mail Tracked 48",
        tracking_format: "{RAND12}GB",
      },
      express: {
        carrier: "dpd",
        name: "DPD Next Day",
        tracking_format: "DPD{RAND12}",
      },
      pickup: {
        carrier: "evri",
        name: "Evri ParcelShop",
        tracking_format: "H{RAND12}",
      },
    },
  },
  US: {
    purchase_country: "US",
    purchase_currency: "USD",
    locale: "en-US",
    vat_rate_bp: 0,
    vat_divisor: 1,
    shipping_minor: {
      standard: 599,
      express: 1299,
      pickup: 399,
      free_standard_threshold: 10000, // $100
      free_label: "$100",
    },
    carriers: {
      // USPS Ground Advantage = standard ecommerce. UPS Next Day Air = express.
      // FedEx OnSite (Walgreens / Dollar General) = pickup points.
      standard: {
        carrier: "usps",
        name: "USPS Ground Advantage",
        tracking_format: "9400{RAND12}US",
      },
      express: {
        carrier: "ups",
        name: "UPS Next Day Air",
        tracking_format: "1Z{RAND12}",
      },
      pickup: {
        carrier: "fedex",
        name: "FedEx OnSite",
        tracking_format: "FX{RAND12}",
      },
    },
  },
  DE: {
    purchase_country: "DE",
    purchase_currency: "EUR",
    locale: "de-DE",
    vat_rate_bp: 1900,
    vat_divisor: 1.19,
    shipping_minor: {
      standard: 499,
      express: 999,
      pickup: 299,
      free_standard_threshold: 10000, // €100
      free_label: "€100",
    },
    carriers: {
      // DHL is the German postal default. Hermes is the discount alternative.
      // DHL Packstation lockers are the dominant pickup option.
      standard: {
        carrier: "dhl",
        name: "DHL Paket",
        tracking_format: "JJD{RAND12}",
      },
      express: {
        carrier: "dhl-express",
        name: "DHL Express",
        tracking_format: "JD{RAND12}",
      },
      pickup: {
        carrier: "dhl-packstation",
        name: "DHL Packstation",
        tracking_format: "JJD{RAND12}",
      },
    },
  },
  JP: {
    purchase_country: "JP",
    purchase_currency: "JPY",
    locale: "ja-JP",
    vat_rate_bp: 1000,
    vat_divisor: 1.1,
    shipping_minor: {
      standard: 600,
      express: 1500,
      pickup: 400,
      free_standard_threshold: 15000, // ¥15,000 (JPY has no minor unit)
      free_label: "¥15,000",
    },
    carriers: {
      // Japan Post is the postal default; Yamato (Kuroneko) is the dominant
      // courier; Sagawa is the premium overnight competitor.
      standard: {
        carrier: "japan-post",
        name: "Japan Post Yū-Pack",
        tracking_format: "{RAND12}JP",
      },
      express: {
        carrier: "yamato",
        name: "Yamato Takkyūbin",
        tracking_format: "YK{RAND12}",
      },
      pickup: {
        carrier: "sagawa",
        name: "Sagawa pickup",
        tracking_format: "SG{RAND12}",
      },
    },
  },
};

// Fallback when the country code in the UI dropdown isn't in the Kustom
// merchant config (e.g. someone picked a country we don't sell to yet).
export const DEFAULT_MARKET_CODE = "SE";

export function getMarket(code?: string | null): MarketConfig {
  if (code && MARKETS[code]) return MARKETS[code];
  return MARKETS[DEFAULT_MARKET_CODE];
}
