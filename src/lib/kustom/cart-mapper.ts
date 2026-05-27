import type { CartItem, Product, ProductVariant } from "@/db";
import type {
  CreateOrderPayload,
  MerchantUrls,
  OrderLine,
  ShippingOption,
} from "./types";
import { callbackToken } from "./callback-auth";

// Playground MID PM00138210 supports CHF/GBP/PLN/USD (not SEK) — see /docs/KUSTOM_INTEGRATION.md
const PURCHASE_COUNTRY = "GB";
const PURCHASE_CURRENCY = "GBP";
const LOCALE = "en-GB";
const VAT_RATE_BP = 2000; // 20.00% UK VAT in basis points
const VAT_DIVISOR = 1.2;

type CartItemWithJoins = CartItem & {
  product: Product;
  variant: ProductVariant;
};

function lineFromItem(item: CartItemWithJoins): OrderLine {
  const total_amount = item.priceAtAdd * item.quantity;
  // Prices are VAT-inclusive: tax portion = total - total/(1 + rate)
  const total_tax_amount = Math.round(total_amount - total_amount / VAT_DIVISOR);
  return {
    type: "physical",
    reference: item.variant.sku,
    name: `${item.product.name} (${item.variant.color} / ${item.variant.size})`,
    quantity: item.quantity,
    quantity_unit: "pcs",
    unit_price: item.priceAtAdd,
    tax_rate: VAT_RATE_BP,
    total_amount,
    total_discount_amount: 0,
    total_tax_amount,
    image_url: item.variant.imageUrl ?? item.product.imageUrl,
  };
}

function fallbackShippingOptions(): ShippingOption[] {
  // Static fallbacks shown if KSA is unavailable. Prices in minor units (pence).
  return [
    {
      id: "std",
      name: "Standard",
      description: "3–5 business days",
      price: 499,
      tax_amount: Math.round(499 - 499 / VAT_DIVISOR),
      tax_rate: VAT_RATE_BP,
      preselected: true,
    },
    {
      id: "exp",
      name: "Express",
      description: "1–2 business days",
      price: 999,
      tax_amount: Math.round(999 - 999 / VAT_DIVISOR),
      tax_rate: VAT_RATE_BP,
    },
  ];
}

export interface BuildCreateOrderInput {
  items: CartItemWithJoins[];
  siteUrl: string;
  enableShippingAssistant?: boolean;
}

export function buildCreateOrderPayload({
  items,
  siteUrl,
  enableShippingAssistant = false,
}: BuildCreateOrderInput): CreateOrderPayload {
  if (items.length === 0) {
    throw new Error("Cannot create checkout for an empty cart");
  }

  const order_lines = items.map(lineFromItem);
  const order_amount = order_lines.reduce((s, l) => s + l.total_amount, 0);
  const order_tax_amount = order_lines.reduce(
    (s, l) => s + l.total_tax_amount,
    0
  );

  const site = siteUrl.replace(/\/$/, "");
  // Callback URLs are protected by an HMAC token derived from the route
  // kind + KUSTOM_CALLBACK_SECRET. If the secret isn't set we silently drop
  // the callbacks so Kustom falls back to its own defaults — keeps the demo
  // working on dev boxes that haven't generated a secret yet.
  let cb: Partial<MerchantUrls> = {};
  if (process.env.KUSTOM_CALLBACK_SECRET) {
    const tok = (kind: Parameters<typeof callbackToken>[0]) =>
      `?token=${callbackToken(kind)}`;
    cb = {
      validation: `${site}/api/kustom/callbacks/validation${tok("validation")}`,
      address_update: `${site}/api/kustom/callbacks/address${tok("address")}`,
      country_change: `${site}/api/kustom/callbacks/country${tok("country")}`,
      shipping_option_update: `${site}/api/kustom/callbacks/shipping-option${tok("shipping_option")}`,
      upsell: `${site}/api/kustom/callbacks/upsell${tok("upsell")}`,
      upsell_validation: `${site}/api/kustom/callbacks/upsell-validation${tok("upsell_validation")}`,
    };
  }

  const merchant_urls: MerchantUrls = {
    terms: `${site}/terms`,
    checkout: `${site}/checkout`,
    confirmation: `${site}/checkout/confirmation?order_id={checkout.order.id}`,
    push: `${site}/api/kustom/push?order_id={checkout.order.id}`,
    ...cb,
  };

  return {
    purchase_country: PURCHASE_COUNTRY,
    purchase_currency: PURCHASE_CURRENCY,
    locale: LOCALE,
    order_amount,
    order_tax_amount,
    order_lines,
    merchant_urls,
    options: {
      allow_separate_shipping_address: enableShippingAssistant,
      // Force Kustom to wait for our /validation callback before authorising
      // payment when callbacks are configured.
      require_validate_callback_success: Boolean(process.env.KUSTOM_CALLBACK_SECRET),
      // Enable confirmation-page upsell — Kustom will call our /upsell endpoint
      // after the order is complete.
      confirmation_page_upsell: Boolean(process.env.KUSTOM_CALLBACK_SECRET),
    },
    shipping_options: fallbackShippingOptions(),
  };
}
