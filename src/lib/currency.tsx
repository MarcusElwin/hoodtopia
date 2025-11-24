"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type CurrencyCode = "USD" | "SEK" | "JPY" | "GBP" | "EUR";

export interface Country {
  code: string;
  name: string;
  currency: CurrencyCode;
  flag: string;
}

export const countries: Country[] = [
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸" },
  { code: "SE", name: "Sweden", currency: "SEK", flag: "🇸🇪" },
  { code: "JP", name: "Japan", currency: "JPY", flag: "🇯🇵" },
  { code: "GB", name: "United Kingdom", currency: "GBP", flag: "🇬🇧" },
  { code: "DE", name: "Germany", currency: "EUR", flag: "🇩🇪" },
];

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  // Exchange rate relative to USD (1 USD = X currency)
  rate: number;
  // Decimal places to show
  decimals: number;
  // Symbol position
  symbolBefore: boolean;
}

export const currencies: Record<CurrencyCode, CurrencyInfo> = {
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    rate: 1,
    decimals: 2,
    symbolBefore: true,
  },
  SEK: {
    code: "SEK",
    symbol: "kr",
    name: "Swedish Krona",
    rate: 10.85, // 1 USD ≈ 10.85 SEK
    decimals: 0,
    symbolBefore: false,
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    rate: 149.50, // 1 USD ≈ 149.50 JPY
    decimals: 0,
    symbolBefore: true,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    rate: 0.79, // 1 USD ≈ 0.79 GBP
    decimals: 2,
    symbolBefore: true,
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    rate: 0.92, // 1 USD ≈ 0.92 EUR
    decimals: 2,
    symbolBefore: true,
  },
};

interface CurrencyContextType {
  country: Country;
  currency: CurrencyInfo;
  setCountry: (countryCode: string) => void;
  formatPrice: (priceInCents: number) => string;
  convertPrice: (priceInCents: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<Country>(countries[0]); // Default to US

  const currency = currencies[country.currency];

  const setCountry = useCallback((countryCode: string) => {
    const found = countries.find((c) => c.code === countryCode);
    if (found) {
      setCountryState(found);
    }
  }, []);

  const convertPrice = useCallback(
    (priceInCents: number): number => {
      // Price is stored in USD cents
      const priceInUSD = priceInCents / 100;
      return priceInUSD * currency.rate;
    },
    [currency.rate]
  );

  const formatPrice = useCallback(
    (priceInCents: number): string => {
      const converted = convertPrice(priceInCents);
      const formatted = converted.toFixed(currency.decimals);

      // Format with thousands separator
      const parts = formatted.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const number = parts.join(".");

      if (currency.symbolBefore) {
        return `${currency.symbol}${number}`;
      } else {
        return `${number} ${currency.symbol}`;
      }
    },
    [convertPrice, currency]
  );

  return (
    <CurrencyContext.Provider
      value={{
        country,
        currency,
        setCountry,
        formatPrice,
        convertPrice,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
