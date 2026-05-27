export interface MerchantUrls {
  terms: string;
  checkout: string;
  confirmation: string;
  push: string;
  // Optional callback URLs — Kustom calls these mid-checkout when present.
  validation?: string;
  shipping_option_update?: string;
  address_update?: string;
  country_change?: string;
  upsell?: string;
  upsell_validation?: string;
}

export interface UpsellLine {
  reference: string;
  name: string;
  quantity: number;
  quantity_unit?: string;
  unit_price: number;
  tax_rate: number;
  total_amount: number;
  total_discount_amount?: number;
  total_tax_amount: number;
  image_url?: string;
  product_url?: string;
  type?: "physical" | "digital";
  merchant_data?: string;
}

export interface OrderLine {
  type?: "physical" | "digital" | "shipping_fee" | "discount" | "sales_tax";
  reference: string;
  name: string;
  quantity: number;
  quantity_unit?: string;
  unit_price: number;
  tax_rate: number;
  total_amount: number;
  total_discount_amount?: number;
  total_tax_amount: number;
  image_url?: string;
  product_url?: string;
}

// Used in Create Order's options[] (fallback shipping when KSA is down).
export interface ShippingOption {
  id: string;
  name: string;
  description?: string;
  price: number;
  tax_amount: number;
  tax_rate: number;
  preselected?: boolean;
  shipping_method?: string;
  delivery_details?: {
    carrier?: string;
    class?: string;
    pickup_location?: {
      id?: string;
      name?: string;
      address?: Record<string, string>;
    };
  };
}

// Used by the KSA Integrator API (POST /shippingoptions response). Stricter
// shape than the Create Order fallback — Kustom validates "type" + "carrier"
// + a delivery_time interval, otherwise rejects with "Basic options not
// allowed in the get shipping options response".
//
// Spec: https://docs.kustom.co/contents/checkout/shipping-assistant/api-integration
export type KsaShippingType =
  | "postal"           // standard mail carrier delivery to address
  | "delivery-address" // direct courier to home/work
  | "pickup-point"     // shop / locker pickup
  | "pickup-box"       // automated parcel locker
  | "same-day"
  | "next-day";

export type KsaShippingClass = "standard" | "express" | "premium";

export interface KsaDeliveryTime {
  /** Business-day window. */
  interval?: { earliest?: number; latest?: number };
  /** Absolute ISO timestamp for time-bounded options (e.g. same-day cutoff). */
  latest?: string;
}

export interface KsaShippingOption {
  id: string;
  type: KsaShippingType;
  carrier: string; // free-form: "postnord", "dhl", "in-house", etc
  name: string;
  description?: string;
  price: number;      // minor units of the order currency
  tax_rate: number;   // basis points (2500 = 25%)
  delivery_time?: KsaDeliveryTime;
  class?: KsaShippingClass;
  preselected?: boolean;
  /** Marks preview options (returned when only country is known). */
  preview?: boolean;
}

export interface CheckoutOptions {
  allow_separate_shipping_address?: boolean;
  date_of_birth_mandatory?: boolean;
  require_validate_callback_success?: boolean;
  confirmation_page_upsell?: boolean;
  // Iframe + confirmation snippet theming (CSS colour strings, e.g. "#a855f7").
  color_button?: string;
  color_button_text?: string;
  color_checkbox?: string;
  color_checkbox_checkmark?: string;
  color_header?: string;
  color_link?: string;
  color_background?: string;
  radius_border?: string;
}

export interface CreateOrderPayload {
  purchase_country: string;
  purchase_currency: string;
  locale: string;
  order_amount: number;
  order_tax_amount: number;
  order_lines: OrderLine[];
  merchant_urls: MerchantUrls;
  options?: CheckoutOptions;
  shipping_options?: ShippingOption[];
  /** Free-form merchant pass-through; surfaced back in Read Order and Management. */
  merchant_reference1?: string;
  merchant_reference2?: string;
}

export interface Address {
  given_name?: string;
  family_name?: string;
  email?: string;
  title?: string;
  street_address?: string;
  street_address2?: string;
  postal_code?: string;
  city?: string;
  region?: string;
  phone?: string;
  country?: string;
  organization_name?: string;
}

export type OrderStatus =
  | "checkout_incomplete"
  | "checkout_complete"
  | "AUTHORIZED"
  | "CAPTURED"
  | "CANCELLED"
  | "EXPIRED"
  | "CLOSED"
  | string;

export interface KustomOrder {
  order_id: string;
  status: OrderStatus;
  purchase_country: string;
  purchase_currency: string;
  locale: string;
  billing_address?: Address;
  customer?: { date_of_birth?: string; gender?: string };
  shipping_address?: Address;
  order_amount: number;
  order_tax_amount: number;
  order_lines: OrderLine[];
  merchant_urls?: MerchantUrls;
  html_snippet?: string;
  started_at?: string;
  completed_at?: string;
  last_modified_at?: string;
  options?: CheckoutOptions;
  selected_shipping_option?: ShippingOption;
}

export type CreateOrderResponse = KustomOrder;
export type ReadOrderResponse = KustomOrder;

export interface ManagementOrder {
  order_id: string;
  status: OrderStatus;
  purchase_country: string;
  purchase_currency: string;
  order_amount: number;
  order_tax_amount: number;
  order_lines: OrderLine[];
  billing_address?: Address;
  shipping_address?: Address;
  customer?: { date_of_birth?: string; gender?: string };
  selected_shipping_option?: ShippingOption;
}
