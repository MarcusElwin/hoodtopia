import Image from "next/image";
import { Package, MapPin } from "lucide-react";
import type { Address, OrderLine, ShippingOption } from "@/lib/kustom/types";

interface Props {
  currency: string;
  lines: OrderLine[];
  shippingAddress?: Address;
  selectedShipping?: ShippingOption;
  estimatedDelivery?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  CHF: "CHF ",
  PLN: "zł",
  SEK: "kr",
  EUR: "€",
};

function fmtAmount(minor: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const value = (minor / 100).toFixed(2);
  return currency === "PLN" || currency === "SEK"
    ? `${value} ${sym}`
    : `${sym}${value}`;
}

function fmtAddress(addr: Address): string {
  return [addr.street_address, addr.postal_code, addr.city, addr.country?.toUpperCase()]
    .filter(Boolean)
    .join(", ");
}

function estimateDelivery(shippingId?: string): string {
  const today = new Date();
  const addDays = (d: number) => {
    const t = new Date(today);
    t.setDate(t.getDate() + d);
    return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  if (shippingId === "exp") return `Arrives ${addDays(1)}–${addDays(2)}`;
  if (shippingId === "pup") return `Ready for pickup ${addDays(2)}–${addDays(3)}`;
  return `Arrives ${addDays(3)}–${addDays(5)}`;
}

export function OrderSummary({
  currency,
  lines,
  shippingAddress,
  selectedShipping,
}: Props) {
  const physicalLines = lines.filter((l) => l.type !== "shipping_fee");

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Order items</h2>
        </div>
        <ul className="space-y-4">
          {physicalLines.map((line, i) => (
            <li
              key={`${line.reference}-${i}`}
              className="flex gap-3 items-start"
            >
              {line.image_url ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                  <Image
                    src={line.image_url}
                    alt={line.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              ) : null}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight">{line.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Qty {line.quantity} · {fmtAmount(line.unit_price, currency)} each
                </p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap">
                {fmtAmount(line.total_amount, currency)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Shipping to</h2>
          </div>
          {shippingAddress ? (
            <div className="text-sm space-y-1">
              <p className="font-medium">
                {[shippingAddress.given_name, shippingAddress.family_name]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </p>
              <p className="text-muted-foreground">{fmtAddress(shippingAddress)}</p>
              {shippingAddress.email ? (
                <p className="text-muted-foreground">{shippingAddress.email}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Shipping address not provided.
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-1">
            {selectedShipping?.name ?? "Delivery"}
          </p>
          <p className="text-xs text-muted-foreground">
            {estimateDelivery(selectedShipping?.id)}
            {selectedShipping?.description
              ? ` · ${selectedShipping.description}`
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
