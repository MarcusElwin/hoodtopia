import type { CartItem, Product, ProductVariant } from "@/db";
import type {
  CreateOrderPayload,
  MerchantUrls,
  OrderLine,
  ShippingOption,
} from "./types";
import { callbackToken } from "./callback-auth";
import { type MarketConfig, getMarket } from "./markets";

// Kustom iframe theme. Mirrors the brass --primary token from globals.css
// expressed as sRGB hex (Kustom's options.color_* fields don't accept
// oklch()). Kept as one place so the regular checkout + the express
// checkout can't drift apart from each other or from the rest of the
// brand. If you change --primary, recompute these.
//   --primary           oklch(0.7 0.13 75) -> #cd9130
//   --primary-foreground oklch(0.1 0.01 75) -> #050301
const IFRAME_THEME = {
  color_button: "#cd9130",        // burnished brass primary
  color_button_text: "#050301",   // near-black foreground on brass
  color_checkbox: "#cd9130",
  color_checkbox_checkmark: "#050301",
  color_header: "#cd9130",
  color_link: "#cd9130",
} as const;

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

/**
 * Build a Create Order payload from raw line items rather than cart rows.
 * Used by the Express Buttons createOrder hook on the PDP — the customer
 * hasn't necessarily added anything to the cart, so we synthesise lines
 * from the selected variant directly. Same merchant_urls / options as the
 * cart flow so confirmation + push + KSA all work identically.
 */
export interface BuildExpressPayloadLine {
  sku: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  imageUrl?: string;
}

export interface BuildExpressPayloadInput {
  lines: BuildExpressPayloadLine[];
  siteUrl: string;
  countryCode?: string | null;
  sessionId?: string;
  traceId?: string;
}

export function buildExpressOrderPayload({
  lines,
  siteUrl,
  countryCode,
  sessionId,
  traceId,
}: BuildExpressPayloadInput): CreateOrderPayload {
  if (lines.length === 0) {
    throw new Error("Cannot create express checkout for empty lines");
  }

  const market = getMarket(countryCode);

  const order_lines: OrderLine[] = lines.map((l) => {
    const total_amount = l.unitPriceMinor * l.quantity;
    const total_tax_amount = Math.round(
      total_amount - total_amount / market.vat_divisor
    );
    return {
      type: "physical",
      reference: l.sku,
      name: l.name,
      quantity: l.quantity,
      quantity_unit: "pcs",
      unit_price: l.unitPriceMinor,
      tax_rate: market.vat_rate_bp,
      total_amount,
      total_discount_amount: 0,
      total_tax_amount,
      image_url: l.imageUrl,
    };
  });

  const order_amount = order_lines.reduce((s, l) => s + l.total_amount, 0);
  const order_tax_amount = order_lines.reduce(
    (s, l) => s + l.total_tax_amount,
    0
  );

  const site = siteUrl.replace(/\/$/, "");
  const pushToken = process.env.KUSTOM_CALLBACK_SECRET
    ? `&token=${callbackToken("push")}`
    : "";

  // For express we keep callbacks minimal — Kustom drives the address
  // flow inside the express sheet and doesn't expect our country-change
  // hooks to fire. We still wire the confirmation + push so we capture
  // the completed order the same way as the normal checkout.
  const merchant_urls: MerchantUrls = {
    terms: `${site}/terms`,
    checkout: `${site}/checkout`,
    confirmation: `${site}/checkout/confirmation?order_id={checkout.order.id}`,
    push: `${site}/api/kustom/push?order_id={checkout.order.id}${pushToken}`,
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
      // KSA collects the address inside the express sheet.
      allow_separate_shipping_address: true,
      ...IFRAME_THEME,
      radius_border: "0", // squared register matches the PDP CTA
    },
    // No fallback shipping_options[] — express flow relies on KSA. The
    // docs require KSA for express buttons anyway.
  };
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

  // Protect the push webhook with the same HMAC token as the other callbacks
  // when a secret is configured. Kustom echoes back the exact URL we register,
  // so the token survives the {checkout.order.id} substitution.
  const pushToken = process.env.KUSTOM_CALLBACK_SECRET
    ? `&token=${callbackToken("push")}`
    : "";

  const merchant_urls: MerchantUrls = {
    terms: `${site}/terms`,
    checkout: `${site}/checkout`,
    confirmation: `${site}/checkout/confirmation?order_id={checkout.order.id}`,
    push: `${site}/api/kustom/push?order_id={checkout.order.id}${pushToken}`,
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
      // Upsell modes per https://docs.kustom.co/contents/checkout/use-cases/upsell:
      //   "per-order" (default) → set confirmation_page_upsell=true in the
      //     create-order payload. Each session opts in via code.
      //   "global"             → omit the flag and enable upsell globally on
      //     the MID via the Kustom Portal. Lets non-code merchants flip it.
      //   "off"                → don't set the flag, no portal config — never
      //     fire upsells.
      // The /upsell merchant_urls callback is configured independently above
      // so KUSTOM_UPSELL_MODE controls only *whether* Kustom invokes it.
      confirmation_page_upsell:
        Boolean(process.env.KUSTOM_CALLBACK_SECRET) &&
        (process.env.KUSTOM_UPSELL_MODE ?? "per-order") === "per-order",
      // Match the Hoodtopia Savile Row theme — these style the Kustom
      // iframe and the post-purchase confirmation snippet so the white
      // card doesn't clash with our dark surface. Brass hex values
      // mirror the --primary token from globals.css. Lifted to the
      // IFRAME_THEME constant so this can't drift from the express path.
      ...IFRAME_THEME,
      radius_border: "0", // squared register matches the PDP CTA
    },
    shipping_options: fallbackShippingOptions(market),
  };
}
