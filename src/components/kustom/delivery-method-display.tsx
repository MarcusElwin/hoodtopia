"use client";

import { useSyncExternalStore } from "react";
import { useCurrency } from "@/lib/currency";

interface DeliveryMethodDisplayProps {
  /** Override locale. Defaults to deriving from the active country picker. */
  locale?: string;
  className?: string;
}

const subscribe = () => () => {};

function localeFor(countryCode: string, currencyCode: string): string {
  const m: Record<string, string> = {
    SE: "sv-SE",
    GB: "en-GB",
    US: "en-US",
    DE: "de-DE",
    JP: "ja-JP",
  };
  if (m[countryCode]) return m[countryCode];
  if (currencyCode === "EUR") return "de-DE";
  return "en-US";
}

// <kustom-delivery-method-display> — shows the carrier logos available for
// the shopper's market (PostNord, DHL, Budbee, etc). Mirror of
// PaymentMethodDisplay; same gate, same locale derivation.
export function DeliveryMethodDisplay({
  locale,
  className,
}: DeliveryMethodDisplayProps) {
  const { country, currency } = useCurrency();

  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const enabled = Boolean(process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_API_KEY);
  if (!mounted || !enabled) return null;

  const resolvedLocale = locale ?? localeFor(country.code, currency.code);

  return (
    <div className={className}>
      <kustom-delivery-method-display locale={resolvedLocale} />
    </div>
  );
}
