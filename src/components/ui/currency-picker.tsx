"use client";

import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency, countries, currencies } from "@/lib/currency";

export function CurrencyPicker() {
  const { country, setCountry } = useCurrency();

  return (
    <Select value={country.code} onValueChange={setCountry}>
      <SelectTrigger className="w-auto gap-2 h-9 px-3 bg-secondary/50 border-border/50">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{country.flag}</span>
            <span className="hidden sm:inline">{currencies[country.currency].code}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {countries.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="flex items-center gap-3">
              <span className="text-lg">{c.flag}</span>
              <span className="flex-1">{c.name}</span>
              <span className="text-muted-foreground text-xs">
                {currencies[c.currency].symbol} {currencies[c.currency].code}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Compact version for mobile/footer
export function CurrencyPickerCompact() {
  const { country, setCountry, currency } = useCurrency();

  return (
    <Select value={country.code} onValueChange={setCountry}>
      <SelectTrigger className="w-[140px] h-9">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{country.flag}</span>
            <span>{currency.code}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {countries.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="flex items-center gap-2">
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
