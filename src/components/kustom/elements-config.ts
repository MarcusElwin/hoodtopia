// Shared helpers for the four Kustom On-site Elements wrappers
// (payment-method-display, delivery-method-display, express-buttons,
// and any future ones). Keeps the enabled-gate consistent with
// layout.tsx's RootLayout — both env vars must be set or the install
// script is never injected, so the elements would never upgrade.

export function elementsEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC &&
      process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_API_KEY
  );
}

const LOCALE_BY_COUNTRY: Record<string, string> = {
  SE: "sv-SE",
  GB: "en-GB",
  US: "en-US",
  DE: "de-DE",
  JP: "ja-JP",
};

export function localeFor(countryCode: string, currencyCode: string): string {
  if (LOCALE_BY_COUNTRY[countryCode]) return LOCALE_BY_COUNTRY[countryCode];
  if (currencyCode === "EUR") return "de-DE";
  return "en-US";
}
