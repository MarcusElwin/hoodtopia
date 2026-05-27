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

// Returns dynamic shipping options for Kustom Shipping Assistant. Prices,
// VAT, and the free-shipping threshold come from MARKETS. Each option
// carries the spec-required type/carrier/delivery_time/class fields — KSA
// rejects "basic" options that lack these.
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
      preselected: true,
      preview: isPreview,
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
      preview: isPreview,
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
      preview: isPreview,
    },
  ];

  return { shipping_options: options };
}
