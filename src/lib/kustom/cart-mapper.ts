import type { CartItem, Product, ProductVariant } from "@/db";
import type {
  CreateOrderPayload,
  MerchantUrls,
  OrderLine,
  ShippingOption,
} from "./types";
import { callbackToken } from "./callback-auth";
import { type MarketConfig, getMarket } from "./markets";

type CartItemWithJoins = CartItem & {
  product: Product;
  variant: ProductVariant;
};

function lineFromItem(item: CartItemWithJoins, market: MarketConfig): OrderLine {
  const total_amount = item.priceAtAdd * item.quantity;
  // Prices are VAT-inclusive: tax portion = total - total/(1 + rate).
  // For markets without VAT (e.g. US), divisor is 1 so total_tax_amount is 0.
  const total_tax_amount = Math.round(
    total_amount - total_amount / market.vat_divisor
  );
  return {
    type: "physical",
    reference: item.variant.sku,
    name: `${item.product.name} (${item.variant.color} / ${item.variant.size})`,
    quantity: item.quantity,
    quantity_unit: "pcs",
    unit_price: item.priceAtAdd,
    tax_rate: market.vat_rate_bp,
    total_amount,
    total_discount_amount: 0,
    total_tax_amount,
    image_url: item.variant.imageUrl ?? item.product.imageUrl,
  };
}

function fallbackShippingOptions(market: MarketConfig): ShippingOption[] {
  const std = market.shipping_minor.standard;
  const exp = market.shipping_minor.express;
  return [
    {
      id: "std",
      name: "Standard",
      description: "3–5 business days",
      price: std,
      tax_amount: Math.round(std - std / market.vat_divisor),
      tax_rate: market.vat_rate_bp,
      preselected: true,
    },
    {
      id: "exp",
      name: "Express",
      description: "1–2 business days",
      price: exp,
      tax_amount: Math.round(exp - exp / market.vat_divisor),
      tax_rate: market.vat_rate_bp,
    },
  ];
}

export interface BuildCreateOrderInput {
  items: CartItemWithJoins[];
  siteUrl: string;
  enableShippingAssistant?: boolean;
  /**
   * ISO 3166-1 alpha-2 country code from the UI's currency switcher. Drives
   * purchase_country / purchase_currency / locale / VAT in the Kustom payload.
   * Falls back to DEFAULT_MARKET_CODE if missing or unknown.
   */
  countryCode?: string | null;
  /**
   * Our internal session identifier (currently DEMO_SESSION_ID). Emitted as
   * merchant_reference1 so we can correlate the Kustom order back to the
   * cart in our DB without an extra lookup.
   */
  sessionId?: string;
  /**
   * Per-create-order trace id (uuid). Lets us find this exact session in
   * server logs even when multiple orders share the same sessionId.
   */
  traceId?: string;
}

export function buildCreateOrderPayload({
  items,
  siteUrl,
  enableShippingAssistant = false,
  countryCode,
  sessionId,
  traceId,
}: BuildCreateOrderInput): CreateOrderPayload {
  if (items.length === 0) {
    throw new Error("Cannot create checkout for an empty cart");
  }

  const market = getMarket(countryCode);

  const order_lines = items.map((i) => lineFromItem(i, market));
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
    purchase_country: market.purchase_country,
    purchase_currency: market.purchase_currency,
    locale: market.locale,
    order_amount,
    order_tax_amount,
    order_lines,
    merchant_urls,
    merchant_reference1: sessionId,
    merchant_reference2: traceId,
    options: {
      allow_separate_shipping_address: enableShippingAssistant,
      require_validate_callback_success: Boolean(process.env.KUSTOM_CALLBACK_SECRET),
      confirmation_page_upsell: Boolean(process.env.KUSTOM_CALLBACK_SECRET),
      // Match the Hoodtopia dark theme — these style the Kustom iframe and
      // the post-purchase confirmation snippet so the white card doesn't
      // clash with our dark surface.
      color_button: "#a855f7", // primary purple
      color_button_text: "#ffffff",
      color_checkbox: "#a855f7",
      color_checkbox_checkmark: "#ffffff",
      color_header: "#a855f7",
      color_link: "#a855f7",
      radius_border: "12",
    },
    shipping_options: fallbackShippingOptions(market),
  };
}
