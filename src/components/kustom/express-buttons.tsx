"use client";

import { useSyncExternalStore } from "react";
import { useCurrency } from "@/lib/currency";
import { elementsEnabled, localeFor } from "./elements-config";

interface ExpressButtonsProps {
  locale?: string;
  className?: string;
}

const subscribe = () => () => {};

// <kustom-express-buttons> — Apple Pay / Klarna / Google Pay / PayPal /
// Amazon Pay one-click checkout. Push / Validation / Confirmation URLs are
// configured in the Portal (Express buttons → Setup), not on the tag.
export function ExpressButtons({ locale, className }: ExpressButtonsProps) {
  const { country, currency } = useCurrency();

  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  if (!mounted || !elementsEnabled()) return null;

  const resolvedLocale = locale ?? localeFor(country.code, currency.code);

  return (
    <div className={className}>
      <kustom-express-buttons locale={resolvedLocale} />
    </div>
  );
}
