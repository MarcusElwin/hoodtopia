"use client";

import { useSyncExternalStore } from "react";
import { useCurrency } from "@/lib/currency";

interface PaymentMethodDisplayProps {
  /**
   * Override locale. Defaults to deriving it from the active currency/country
   * picker so SE → sv-SE, GB → en-GB, etc.
   */
  locale?: string;
  /** Comma-separated payment method ids to hide. */
  exclude?: string;
  className?: string;
}

const subscribe = () => () => {};

// Maps the country/currency picker to one of Kustom's supported 5-char locales.
// Spec: https://docs.kustom.co/contents/checkout/kustom-elements/integration-guide/usage#supported-locales
function localeFor(countryCode: string, currencyCode: string): string {
  const m: Record<string, string> = {
    SE: "sv-SE",
    GB: "en-GB",
    US: "en-US",
    DE: "de-DE",
    JP: "ja-JP",
  };
  if (m[countryCode]) return m[countryCode];
  // Fallback: try the currency.
  if (currencyCode === "EUR") return "de-DE";
  return "en-US";
}

// Renders Kustom's <kustom-payment-method-display> custom element. Defers
// mount until after hydration so React doesn't diff the element while the
// install script (loaded in app/layout.tsx) attaches its shadow DOM.
//
// Only `locale` and `exclude` are valid attributes per the spec; the merchant
// ID comes from the data-public-api-key on the install script, not from us.
export function PaymentMethodDisplay({
  locale,
  exclude,
  className,
}: PaymentMethodDisplayProps) {
  const { country, currency } = useCurrency();

  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  // The install script env var doubles as the on/off switch for the whole
  // Elements integration — if it's not configured, render nothing rather
  // than emit a tag the loader will never pick up.
  const enabled = Boolean(process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_API_KEY);
  if (!mounted || !enabled) return null;

  const resolvedLocale = locale ?? localeFor(country.code, currency.code);

  return (
    <div className={className}>
      <kustom-payment-method-display
        locale={resolvedLocale}
        {...(exclude ? { exclude } : {})}
      />
    </div>
  );
}
