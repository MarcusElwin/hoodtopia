"use client";

import { useSyncExternalStore } from "react";
import { useCurrency } from "@/lib/currency";
import { elementsEnabled, localeFor } from "./elements-config";

interface PaymentMethodDisplayProps {
  /** Override locale. Defaults to deriving it from useCurrency(). */
  locale?: string;
  /** Comma-separated payment method ids to hide. */
  exclude?: string;
  className?: string;
}

const subscribe = () => () => {};

// Renders <kustom-payment-method-display>. Gated on BOTH elements env vars
// matching layout.tsx so we never emit a tag the install script can't upgrade.
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

  if (!mounted || !elementsEnabled()) return null;

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
