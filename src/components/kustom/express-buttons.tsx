"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useCurrency } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { ELEMENTS_ENABLED, localeFor } from "./elements-config";

// Kustom's JS API global injected by the Elements loader script.
type KustomElements = (
  method: string,
  selectorOrPayload: string | Record<string, unknown>,
  payload?: Record<string, unknown>
) => Promise<unknown>;
declare global {
  interface Window {
    kustomElements?: KustomElements & {
      _internal?: { loadResolve?: unknown };
    };
  }
}

/** Single line passed to Kustom's express initialize. Minor units. */
export interface ExpressLine {
  name: string;
  sku?: string;
  unitPriceMinor: number;
  quantity: number;
}

interface ExpressButtonsProps {
  /** Convenience for single-variant PDPs — equivalent to a single-line lines array. */
  variantName?: string;
  variantSku?: string;
  unitPriceMinor?: number;
  quantity?: number;
  /** Multi-line mode for the cart. Takes precedence over the single-line props. */
  lines?: ExpressLine[];
  /** ISO 3166-1 alpha-2 country. Drives the VAT rate in taxAmount. */
  countryCode?: string;
  /** Pin a specific locale; otherwise derived from country + currency. */
  locale?: string;
  className?: string;
}

// Same VAT rates as src/lib/kustom/markets.ts — duplicated to avoid pulling
// the entire server-side markets module into the client bundle.
const VAT_BY_COUNTRY: Record<string, number> = {
  SE: 0.25,
  GB: 0.20,
  US: 0.0,
  DE: 0.19,
  JP: 0.10,
};

const ELEMENT_ID = "hoodtopia-express-buttons";

const subscribe = () => () => {};

// Wait for window.kustomElements to be defined (script loads async).
// Polls with quick backoff for up to ~5s, then gives up.
async function awaitKustom(): Promise<KustomElements | null> {
  if (typeof window === "undefined") return null;
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const k = window.kustomElements;
    if (typeof k === "function") return k as KustomElements;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

// <kustom-express-buttons> — Apple Pay / Klarna / Google Pay / PayPal /
// Amazon Pay one-click checkout. The element itself renders nothing until
// you call kustomElements("express.initialize", ...) with the order lines
// (see https://docs.kustom.co/contents/checkout/kustom-elements/elements/express).
//
// We use the "Initialize with Order Lines" flow: pass the selected variant
// directly and let the SDK create the Kustom Checkout order. KSA must be
// configured on the merchant for this to work.
export function ExpressButtons({
  variantName,
  variantSku,
  unitPriceMinor,
  quantity = 1,
  lines,
  countryCode,
  locale,
  className,
}: ExpressButtonsProps) {
  const { country, currency } = useCurrency();
  const initRunRef = useRef(0);
  // tRPC vanilla client so we can call it from inside the createOrder
  // callback (which lives outside React's render lifecycle).
  const trpcClient = trpc.useUtils().client;

  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const resolvedCountry = countryCode ?? country.code;
  const resolvedLocale = locale ?? localeFor(resolvedCountry, currency.code);
  const resolvedCurrency = currency.code.toLowerCase();

  // Normalise input: either the lines prop (cart) or the single-variant
  // shorthand (PDP). Serialised to a stable string so React effect deps
  // can use it as a single dependency without ref churn.
  const effectiveLines: ExpressLine[] = lines && lines.length > 0
    ? lines
    : variantName && unitPriceMinor
      ? [{ name: variantName, sku: variantSku, unitPriceMinor, quantity }]
      : [];
  const linesKey = JSON.stringify(effectiveLines);

  useEffect(() => {
    if (!mounted || !ELEMENTS_ENABLED) return;
    if (effectiveLines.length === 0) return;

    // Increment a "this is the latest init request" token. If props
    // change again before kustomElements becomes available, the stale
    // call below short-circuits and doesn't clobber a newer init.
    const runId = ++initRunRef.current;

    const vatRate = VAT_BY_COUNTRY[resolvedCountry] ?? 0;
    // Display order lines shown in the express sheet BEFORE the real
    // Kustom order exists. The docs' order-lines shape is strict:
    // only name / totalAmount / taxAmount / quantity are accepted. We
    // deliberately do not pass `reference` here — Klarna's validator
    // rejects unknown keys in some flows.
    const displayLines = effectiveLines.map((l) => {
      const totalAmount = l.unitPriceMinor * l.quantity;
      const taxAmount = vatRate > 0
        ? Math.round(totalAmount - totalAmount / (1 + vatRate))
        : 0;
      return {
        name: l.name,
        totalAmount,
        taxAmount,
        quantity: l.quantity,
      };
    });

    (async () => {
      const k = await awaitKustom();
      if (!k || runId !== initRunRef.current) return;

      try {
        await k("express.initialize", `#${ELEMENT_ID}`, {
          currency: resolvedCurrency,
          orderLines: displayLines,
          shippingAddressRequired: true,
          // Defer real Kustom order creation until the consumer is about
          // to pay. This is the only flow that lets us inject our own
          // merchant_urls (confirmation + push), without which Klarna
          // would redirect to Kustom's default confirmation page and our
          // backend would never see the order.
          createOrder: (
            resolve: (v: { orderId: string }) => void,
            reject: (e: unknown) => void
          ) => {
            trpcClient.checkout.initExpressCheckout
              .mutate({
                lines: effectiveLines.map((l) => ({
                  sku: l.sku ?? "no-sku",
                  name: l.name,
                  unitPriceMinor: l.unitPriceMinor,
                  quantity: l.quantity,
                })),
                countryCode: resolvedCountry,
              })
              .then((res) => resolve({ orderId: res.order_id }))
              .catch((err) => {
                console.error("[express] createOrder failed:", err);
                reject(err);
              });
          },
          onConfirm: (response: { redirectUrl?: string }) => {
            if (response?.redirectUrl) {
              window.location.href = response.redirectUrl;
            }
          },
          onError: (err: unknown) => {
            // Surface the full payload so we can see whether it was a
            // MERCHANT_HOOK_INVALID_RESPONSE, MERCHANT_ABORTED, or a
            // payment-side rejection.
            console.error("[express] error:", err);
          },
        });
      } catch (err) {
        // Logged but non-fatal — failing init shouldn't break the PDP.
        console.warn("[express] initialize failed:", err);
      }
    })();
    // effectiveLines deliberately omitted — linesKey is its hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, linesKey, resolvedCurrency, resolvedCountry, trpcClient]);

  if (!mounted || !ELEMENTS_ENABLED) return null;
  if (effectiveLines.length === 0) return null;

  return (
    <div className={className}>
      <kustom-express-buttons id={ELEMENT_ID} locale={resolvedLocale} />
    </div>
  );
}
