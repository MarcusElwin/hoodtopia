// Currency presentation helpers shared between server (AI prompts) and client (UI).
// Keep this small — full ICU formatting lives in the existing CurrencyProvider.

const SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CHF: "CHF ",
  PLN: "zł",
  SEK: "kr",
  JPY: "¥",
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? `${code} `;
}

// Format minor units (pence/öre/cents) into a locale-leaning string.
// PLN and SEK conventionally trail the symbol; everything else leads.
export function formatMinor(minor: number, code: string): string {
  const sym = currencySymbol(code);
  const value = (minor / 100).toFixed(2);
  return code === "PLN" || code === "SEK" ? `${value} ${sym.trim()}` : `${sym}${value}`;
}
