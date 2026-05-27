import type { Address, ShippingOption } from "./types";

const VAT_RATE_BP = 2000; // 20.00% UK VAT
const VAT_DIVISOR = 1.2;

function withTax(price: number): Pick<ShippingOption, "price" | "tax_amount" | "tax_rate"> {
  return {
    price,
    tax_amount: Math.round(price - price / VAT_DIVISOR),
    tax_rate: VAT_RATE_BP,
  };
}

function hasFullAddress(addr?: Address): boolean {
  return Boolean(addr?.postal_code && addr?.country);
}

export interface BuildShippingOptionsInput {
  shipping_address?: Address;
  billing_address?: Address;
  purchase_country?: string;
  order_amount?: number;
}

export interface BuildShippingOptionsResult {
  shipping_options: ShippingOption[];
  preview: boolean;
}

// Returns dynamic shipping options for Kustom Shipping Assistant. When only
// country-level info is known (no postal code), marks the response as preview
// so KCO refreshes once a full address is entered.
export function buildShippingOptions({
  shipping_address,
  billing_address,
  order_amount,
}: BuildShippingOptionsInput): BuildShippingOptionsResult {
  const addr = shipping_address?.postal_code ? shipping_address : billing_address;
  const preview = !hasFullAddress(addr);

  const freeStandard = (order_amount ?? 0) >= 10000; // free standard over £100

  const options: ShippingOption[] = [
    {
      id: "std",
      name: freeStandard ? "Standard (free over £100)" : "Standard",
      description: "3–5 business days",
      ...withTax(freeStandard ? 0 : 499),
      preselected: true,
      shipping_method: "Home",
    },
    {
      id: "exp",
      name: "Express",
      description: "1–2 business days",
      ...withTax(999),
      shipping_method: "Express",
    },
    {
      id: "pup",
      name: "Pickup point",
      description: "Collect at your nearest service point",
      ...withTax(299),
      shipping_method: "PickUpStore",
    },
  ];

  return { shipping_options: options, preview };
}
