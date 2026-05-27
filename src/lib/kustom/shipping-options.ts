import type { Address, KsaShippingOption } from "./types";
import { getMarket } from "./markets";

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
    {
      id: "pup",
      type: "pickup-point",
      carrier: carriers.pickup.carrier,
      name: carriers.pickup.name,
      description: "Collect at your nearest service point",
      price: market.shipping_minor.pickup,
      tax_rate: market.vat_rate_bp,
      delivery_time: { interval: { earliest: 2, latest: 3 } },
      class: "standard",
      ...previewFlag,
    },
  ];

  return { shipping_options: options };
}
