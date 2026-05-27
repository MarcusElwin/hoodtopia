// Shared helpers for the Kustom On-site Elements wrappers.
//
// IMPORTANT: ELEMENTS_ENABLED is a module-level constant, NOT a function.
// Next.js webpack only inlines `process.env.NEXT_PUBLIC_X` at literal access
// sites at build time. Wrapping in a function defers the read to runtime,
// where the env is `undefined` in the browser → the check always returns
// false even though the var is set in Vercel. The constant form is
// substituted at build into a true/false literal that tree-shakes cleanly.
export const ELEMENTS_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC &&
    process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_API_KEY
);

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
