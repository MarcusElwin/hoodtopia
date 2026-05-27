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

export interface CheckoutOptions {
  allow_separate_shipping_address?: boolean;
  date_of_birth_mandatory?: boolean;
  require_validate_callback_success?: boolean;
  confirmation_page_upsell?: boolean;
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
