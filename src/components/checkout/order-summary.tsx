import Image from "next/image";
import { Package, MapPin, Truck } from "lucide-react";
import type { Address, OrderLine, ShippingOption } from "@/lib/kustom/types";
import { formatMinor } from "@/lib/kustom/currency";

interface Props {
  currency: string;
  lines: OrderLine[];
  shippingAddress?: Address;
  selectedShipping?: ShippingOption;
  estimatedDelivery?: string;
}

const fmtAmount = formatMinor;

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
    <div className="grid md:grid-cols-5 gap-6">
      <div className="md:col-span-3 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Order items</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {physicalLines.length}{" "}
            {physicalLines.length === 1 ? "item" : "items"}
          </span>
        </div>
        <ul className="divide-y">
          {physicalLines.map((line, i) => (
            <li
              key={`${line.reference}-${i}`}
              className="flex gap-4 items-start py-4 first:pt-0 last:pb-0"
            >
              {line.image_url ? (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  <Image
                    src={line.image_url}
                    alt={line.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              ) : null}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-snug line-clamp-2">
                  {line.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Qty {line.quantity} ·{" "}
                  {fmtAmount(line.unit_price, currency)} each
                </p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap">
                {fmtAmount(line.total_amount, currency)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="md:col-span-2 rounded-xl border bg-card p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold">Shipping to</h2>
          </div>
          {shippingAddress ? (
            <div className="text-sm space-y-0.5 pl-10">
              <p className="font-medium">
                {[shippingAddress.given_name, shippingAddress.family_name]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {fmtAddress(shippingAddress)}
              </p>
              {shippingAddress.email ? (
                <p className="text-muted-foreground text-xs pt-1">
                  {shippingAddress.email}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground pl-10">
              Shipping address not provided.
            </p>
          )}
        </div>

        <div className="border-t pt-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold">
              {selectedShipping?.name ?? "Delivery"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground pl-10">
            {estimateDelivery(selectedShipping?.id)}
          </p>
          {selectedShipping?.description ? (
            <p className="text-xs text-muted-foreground pl-10 mt-0.5">
              {selectedShipping.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
