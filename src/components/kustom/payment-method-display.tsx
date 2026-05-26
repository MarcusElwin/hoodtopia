"use client";

import { useSyncExternalStore } from "react";

interface PaymentMethodDisplayProps {
  amount: number; // minor units (öre)
  currency?: string;
  locale?: string;
  purchaseCountry?: string;
}

const subscribe = () => () => {};

// Renders Kustom's <kustom-payment-method-display> custom element. Defers mount
// until after hydration so React doesn't diff the element while the loader
// script is attaching its shadow DOM.
export function PaymentMethodDisplay({
  amount,
  currency = "SEK",
  locale = "sv-SE",
  purchaseCountry = "SE",
}: PaymentMethodDisplayProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const merchantId = process.env.NEXT_PUBLIC_KUSTOM_MERCHANT_ID;
  if (!mounted || !merchantId) return null;

  return (
    <kustom-payment-method-display
      amount={amount}
      currency={currency}
      locale={locale}
      purchase-country={purchaseCountry}
      merchant-id={merchantId}
    />
  );
}
