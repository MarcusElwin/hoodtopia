import type { Address, ShippingOption } from "./types";
import { getMarket } from "./markets";

function hasFullAddress(addr?: Address): boolean {
  return Boolean(addr?.postal_code && addr?.country);
}

export interface BuildShippingOptionsInput {
  shipping_address?: Address;
  billing_address?: Address;
  /** ISO 3166-1 alpha-2 from Kustom's request. */
  purchase_country?: string;
  /** Order subtotal in the market's minor units (e.g. öre / pence). */
  order_amount?: number;
}

export interface BuildShippingOptionsResult {
  shipping_options: ShippingOption[];
  preview: boolean;
}

// Returns dynamic shipping options for Kustom Shipping Assistant. Prices,
// VAT, and the free-shipping threshold come from MARKETS so SE customers
// see SEK prices and "free over 1000 kr", GB customers see £ and "free
// over £100", etc.
//
// When only country-level info is known (no postal code), marks the
// response as preview so KCO refreshes once a full address is entered.
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
  const preview = !hasFullAddress(addr);

  const freeStandard =
    (order_amount ?? 0) >= market.shipping_minor.free_standard_threshold;

  const withTax = (price: number) => ({
    price,
    tax_amount: Math.round(price - price / market.vat_divisor),
    tax_rate: market.vat_rate_bp,
  });

  const options: ShippingOption[] = [
    {
      id: "std",
      name: freeStandard
        ? `Standard (free over ${market.shipping_minor.free_label})`
        : "Standard",
      description: "3–5 business days",
      ...withTax(freeStandard ? 0 : market.shipping_minor.standard),
      preselected: true,
      shipping_method: "Home",
    },
    {
      id: "exp",
      name: "Express",
      description: "1–2 business days",
      ...withTax(market.shipping_minor.express),
      shipping_method: "Express",
    },
    {
      id: "pup",
      name: "Pickup point",
      description: "Collect at your nearest service point",
      ...withTax(market.shipping_minor.pickup),
      shipping_method: "PickUpStore",
    },
  ];

  return { shipping_options: options, preview };
}
