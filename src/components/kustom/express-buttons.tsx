"use client";

import { useSyncExternalStore } from "react";
import { useCurrency } from "@/lib/currency";

interface ExpressButtonsProps {
  /** Override locale. Defaults to deriving from the active country picker. */
  locale?: string;
  className?: string;
}

const subscribe = () => () => {};

function localeFor(countryCode: string, currencyCode: string): string {
  const m: Record<string, string> = {
    SE: "en-SE", // Kustom's express snippet defaults to en-SE for SE markets
    GB: "en-GB",
    US: "en-US",
    DE: "de-DE",
    JP: "ja-JP",
  };
  if (m[countryCode]) return m[countryCode];
  if (currencyCode === "EUR") return "en-DE";
  return "en-US";
}

// Renders <kustom-express-buttons> for one-click checkout (Apple Pay, Klarna,
// Google Pay, Amazon Pay, PayPal — whichever are enabled in the Portal under
// Elements → Express buttons). The button payload comes from Kustom; we just
// drop the tag.
//
// The push/validation/confirmation URLs the Express flow needs are configured
// in the Portal (Express buttons → Setup), not on the tag itself. We point
// them at our existing /api/kustom/push, /api/kustom/callbacks/validation, and
// /checkout/confirmation routes so the express flow re-uses the same backend.
export function ExpressButtons({ locale, className }: ExpressButtonsProps) {
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
      <kustom-express-buttons locale={resolvedLocale} />
    </div>
  );
}
