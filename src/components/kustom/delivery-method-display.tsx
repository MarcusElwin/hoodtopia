"use client";

import { useSyncExternalStore } from "react";
import { useCurrency } from "@/lib/currency";
import { elementsEnabled, localeFor } from "./elements-config";

interface DeliveryMethodDisplayProps {
  locale?: string;
  className?: string;
}

const subscribe = () => () => {};

// <kustom-delivery-method-display> — carrier logos for the shopper's market.
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

  if (!mounted || !elementsEnabled()) return null;

  const resolvedLocale = locale ?? localeFor(country.code, currency.code);

  return (
    <div className={className}>
      <kustom-delivery-method-display locale={resolvedLocale} />
    </div>
  );
}
