import type { OrderLine, ShippingOption } from "./types";

// Recomputes order_amount + order_tax_amount from the line items Kustom sent us.
// Used by address_update / country_change / shipping_option_update callbacks.
//
// We trust Kustom's `total_amount` / `total_tax_amount` per line — the callback
// surface doesn't let us re-price (we don't know the user's currency switch
// trade-offs from this context), only re-sum and optionally add/remove lines.

export interface RecomputedOrder {
  order_amount: number;
  order_tax_amount: number;
  order_lines: OrderLine[];
  shipping_options?: ShippingOption[];
  purchase_currency: string;
}

export interface RecomputeInput {
  order_lines: OrderLine[];
  purchase_currency: string;
  selected_shipping_option?: ShippingOption;
  shipping_options?: ShippingOption[];
}

export function recomputeOrder(input: RecomputeInput): RecomputedOrder {
  const lines = [...input.order_lines];

  // If a shipping option is selected, ensure it's present as a shipping_fee line.
  // Kustom usually injects this for us, but country_change can blow it away.
  if (input.selected_shipping_option) {
    const opt = input.selected_shipping_option;
    const hasShippingLine = lines.some((l) => l.type === "shipping_fee");
    if (!hasShippingLine) {
      lines.push({
        type: "shipping_fee",
        reference: opt.id,
        name: opt.name,
        quantity: 1,
        unit_price: opt.price,
        tax_rate: opt.tax_rate,
        total_amount: opt.price,
        total_tax_amount: opt.tax_amount,
      });
    }
  }

  const order_amount = lines.reduce((s, l) => s + l.total_amount, 0);
  const order_tax_amount = lines.reduce((s, l) => s + l.total_tax_amount, 0);

  return {
    order_amount,
    order_tax_amount,
    order_lines: lines,
    purchase_currency: input.purchase_currency,
    shipping_options: input.shipping_options,
  };
}
