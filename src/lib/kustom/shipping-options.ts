import type { Address, KsaLocation, KsaShippingOption } from "./types";
import { getMarket } from "./markets";

// Per-market sample pickup locations for the `pup` option. Kustom's KSA
// spec requires any `pickup-*` type to carry a non-empty `locations[]`
// — without it the option is rejected as "basic". For a demo we fake a
// short list per country; a real integration would call the carrier's
// location-search API with the customer's postal code.
//
// Prices are in minor units of the market's currency and stack on top
// of the option's base `price` (so 0 = the locker matches the option
// price, >0 = a premium locker).
const PICKUP_LOCATIONS_BY_COUNTRY: Record<string, KsaLocation[]> = {
  SE: [
    {
      id: "se-instabox-norrmalm",
      name: "Instabox Norrmalm",
      price: 0,
      address: { street_address: "Drottninggatan 71", postal_code: "11136", city: "Stockholm", country: "SE" },
      coordinates: { lat: 59.336, lng: 18.063 },
      operational_hours: { default: [{ always_open: true }] },
    },
    {
      id: "se-instabox-sodermalm",
      name: "Instabox Södermalm",
      price: 0,
      address: { street_address: "Götgatan 28", postal_code: "11626", city: "Stockholm", country: "SE" },
      coordinates: { lat: 59.317, lng: 18.073 },
      operational_hours: { default: [{ always_open: true }] },
    },
    {
      id: "se-instabox-vasastan",
      name: "Instabox Vasastan",
      price: 0,
      address: { street_address: "Odengatan 65", postal_code: "11322", city: "Stockholm", country: "SE" },
      coordinates: { lat: 59.343, lng: 18.052 },
      operational_hours: { default: [{ always_open: true }] },
    },
  ],
  GB: [
    {
      id: "gb-evri-shoreditch",
      name: "Evri ParcelShop — Shoreditch",
      price: 0,
      address: { street_address: "55 Old Street", postal_code: "EC1V 9HX", city: "London", country: "GB" },
    },
    {
      id: "gb-evri-soho",
      name: "Evri ParcelShop — Soho",
      price: 0,
      address: { street_address: "12 Brewer Street", postal_code: "W1F 0SE", city: "London", country: "GB" },
    },
  ],
  US: [
    {
      id: "us-ups-soho",
      name: "UPS Access Point — SoHo",
      price: 0,
      address: { street_address: "120 W Broadway", postal_code: "10013", city: "New York", country: "US" },
    },
  ],
  DE: [
    {
      id: "de-dhl-mitte",
      name: "DHL Packstation Mitte",
      price: 0,
      address: { street_address: "Friedrichstraße 90", postal_code: "10117", city: "Berlin", country: "DE" },
    },
  ],
  JP: [
    {
      id: "jp-yamato-shibuya",
      name: "Yamato Shibuya Center",
      price: 0,
      address: { street_address: "2-21-1 Dogenzaka", postal_code: "1500043", city: "Tokyo", country: "JP" },
    },
  ],
};

function hasFullAddress(addr?: Address): boolean {
  return Boolean(addr?.postal_code && addr?.country);
}

export interface BuildShippingOptionsInput {
  shipping_address?: Address;
  billing_address?: Address;
  /** ISO 3166-1 alpha-2 from Kustom's request. */
  purchase_country?: string;
  /** Order subtotal in the market's minor units. */
  order_amount?: number;
}

export interface BuildShippingOptionsResult {
  shipping_options: KsaShippingOption[];
}

// Returns dynamic shipping options for Kustom Shipping Assistant.
//
// Kustom's KSA validator rejects responses with "fallback-style" fields
// (`preselected`, and `preview: false` emitted explicitly). The Portal
// test reports these as: "Basic options not allowed in the get shipping
// options response." Two rules we now follow:
//   1. Never include `preselected` on KSA options. That field belongs on
//      the static `shipping_options` fallback in Create Order, not here.
//   2. Only set `preview: true` when the request actually IS a preview
//      (country-only / partial address). Otherwise omit the field
//      entirely — never send `preview: false`.
//
// Prices, VAT, and the free-shipping threshold come from MARKETS.
export function buildShippingOptions({
  shipping_address,
  billing_address,
  purchase_country,
  order_amount,
}: BuildShippingOptionsInput): BuildShippingOptionsResult {
  const market = getMarket(
    shipping_address?.country?.toUpperCase() ?? purchase_country
  );
  const addr = shipping_address?.postal_code ? shipping_address : billing_address;
  const isPreview = !hasFullAddress(addr);
  // Only include `preview` when true — never as `preview: false`.
  const previewFlag = isPreview ? { preview: true as const } : {};

  const freeStandard =
    (order_amount ?? 0) >= market.shipping_minor.free_standard_threshold;

  const { carriers } = market;
  const options: KsaShippingOption[] = [
    {
      id: "std",
      type: "postal",
      carrier: carriers.standard.carrier,
      name: freeStandard
        ? `${carriers.standard.name} (free over ${market.shipping_minor.free_label})`
        : carriers.standard.name,
      description: "3–5 business days",
      price: freeStandard ? 0 : market.shipping_minor.standard,
      tax_rate: market.vat_rate_bp,
      delivery_time: { interval: { earliest: 3, latest: 5 } },
      class: "standard",
      ...previewFlag,
    },
    {
      id: "exp",
      type: "delivery-address",
      carrier: carriers.express.carrier,
      name: carriers.express.name,
      description: "1–2 business days",
      price: market.shipping_minor.express,
      tax_rate: market.vat_rate_bp,
      delivery_time: { interval: { earliest: 1, latest: 2 } },
      class: "express",
      ...previewFlag,
    },
  ];

  // pickup-point option REQUIRES a non-empty locations[] per the KSA spec.
  // Look up sample lockers for this market; only add the option if we have
  // at least one. (Markets without sample locations just won't see a
  // pickup tile — better than emitting an invalid option.)
  const pickupLocations =
    PICKUP_LOCATIONS_BY_COUNTRY[market.purchase_country] ?? [];
  if (pickupLocations.length > 0) {
    options.push({
      id: "pup",
      type: "pickup-point",
      carrier: carriers.pickup.carrier,
      name: carriers.pickup.name,
      description: "Collect at your nearest service point",
      price: market.shipping_minor.pickup,
      tax_rate: market.vat_rate_bp,
      delivery_time: { interval: { earliest: 2, latest: 3 } },
      class: "standard",
      locations: pickupLocations,
      ...previewFlag,
    });
  }

  return { shipping_options: options };
}
