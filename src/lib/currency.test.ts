import { describe, it, expect } from 'vitest';
import { currencies, countries, type CurrencyCode } from './currency';

describe('Currency Configuration', () => {
  describe('currencies object', () => {
    it('should have all required currency codes', () => {
      const expectedCurrencies: CurrencyCode[] = ['USD', 'SEK', 'JPY', 'GBP', 'EUR'];
      expectedCurrencies.forEach((code) => {
        expect(currencies[code]).toBeDefined();
      });
    });

    it('should have USD as base currency with rate 1', () => {
      expect(currencies.USD.rate).toBe(1);
    });

    it('should have valid rates for all currencies', () => {
      Object.values(currencies).forEach((currency) => {
        expect(currency.rate).toBeGreaterThan(0);
        expect(typeof currency.rate).toBe('number');
      });
    });

    it('should have valid decimal places', () => {
      Object.values(currencies).forEach((currency) => {
        expect(currency.decimals).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(currency.decimals)).toBe(true);
      });
    });

    it('should have non-empty symbols', () => {
      Object.values(currencies).forEach((currency) => {
        expect(currency.symbol).toBeTruthy();
        expect(currency.symbol.length).toBeGreaterThan(0);
      });
    });

    it('should have valid symbolBefore boolean', () => {
      Object.values(currencies).forEach((currency) => {
        expect(typeof currency.symbolBefore).toBe('boolean');
      });
    });
  });

  describe('countries array', () => {
    it('should have all countries defined', () => {
      expect(countries.length).toBeGreaterThan(0);
    });

    it('should have valid country structures', () => {
      countries.forEach((country) => {
        expect(country.code).toBeTruthy();
        expect(country.name).toBeTruthy();
        expect(country.currency).toBeTruthy();
        expect(country.flag).toBeTruthy();
      });
    });

    it('should have currencies that exist in currencies object', () => {
      countries.forEach((country) => {
        expect(currencies[country.currency]).toBeDefined();
      });
    });
  });

  // formatMoney: prices arrive ALREADY in the active currency (Medusa region
  // price), stored as "major × 100" by the adapters. formatMoney divides by 100
  // and formats — NO FX. This mirrors the hook's implementation.
  describe('formatMoney (no-FX display)', () => {
    const formatMoney = (amountCents: number, code: CurrencyCode): string => {
      const c = currencies[code];
      const major = amountCents / 100;
      const formatted = major.toFixed(c.decimals);
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const number = parts.join('.');
      return c.symbolBefore ? `${c.symbol}${number}` : `${number} ${c.symbol}`;
    };

    it('formats a region-priced USD amount', () => {
      expect(formatMoney(999, 'USD')).toBe('$9.99'); // $9.99 sticker
    });

    it('formats SEK with no decimals, symbol after (no re-conversion)', () => {
      // $9.99 sticker priced in SEK region = 108 -> stored 10800
      expect(formatMoney(10800, 'SEK')).toBe('108 kr');
    });

    it('formats JPY with no decimals (stored major × 100)', () => {
      // ¥11,999 stored as 11999 * 100
      expect(formatMoney(1199900, 'JPY')).toBe('¥11,999');
    });

    it('formats EUR with two decimals', () => {
      expect(formatMoney(7359, 'EUR')).toBe('€73.59'); // €73.59
    });

    it('formats GBP with two decimals', () => {
      expect(formatMoney(6319, 'GBP')).toBe('£63.19'); // £63.19
    });

    it('applies a thousands separator', () => {
      expect(formatMoney(86400, 'SEK')).toBe('864 kr'); // hoodie in SEK
      expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    });
  });

  describe('Price formatting logic', () => {
    it('should format USD with symbol before', () => {
      const amount = 59.99;
      const formatted = `${currencies.USD.symbol}${amount.toFixed(currencies.USD.decimals)}`;
      expect(formatted).toBe('$59.99');
    });

    it('should format SEK with symbol after and no decimals', () => {
      const amount = 650;
      const formatted = `${amount.toFixed(currencies.SEK.decimals)} ${currencies.SEK.symbol}`;
      expect(formatted).toBe('650 kr');
    });

    it('should format JPY with symbol before and no decimals', () => {
      const amount = 8969;
      const formatted = `${currencies.JPY.symbol}${amount.toFixed(currencies.JPY.decimals)}`;
      expect(formatted).toBe('¥8969');
    });

    it('should format GBP with symbol before', () => {
      const amount = 47.39;
      const formatted = `${currencies.GBP.symbol}${amount.toFixed(currencies.GBP.decimals)}`;
      expect(formatted).toBe('£47.39');
    });

    it('should format EUR with symbol before', () => {
      const amount = 55.19;
      const formatted = `${currencies.EUR.symbol}${amount.toFixed(currencies.EUR.decimals)}`;
      expect(formatted).toBe('€55.19');
    });

    it('should handle thousands separator correctly', () => {
      const amount = 1234.56;
      const parts = amount.toFixed(2).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = parts.join('.');
      expect(formatted).toBe('1,234.56');
    });
  });
});
