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

  describe('Currency conversion logic', () => {
    // Test the conversion math that would be used in convertPrice
    it('should convert USD cents to USD correctly', () => {
      const priceInCents = 5999; // $59.99
      const priceInUSD = priceInCents / 100;
      const converted = priceInUSD * currencies.USD.rate;
      expect(converted).toBe(59.99);
    });

    it('should convert USD cents to SEK correctly', () => {
      const priceInCents = 5999; // $59.99
      const priceInUSD = priceInCents / 100;
      const converted = priceInUSD * currencies.SEK.rate;
      expect(converted).toBeCloseTo(650.89, 1); // 59.99 * 10.85
    });

    it('should convert USD cents to JPY correctly', () => {
      const priceInCents = 5999; // $59.99
      const priceInUSD = priceInCents / 100;
      const converted = priceInUSD * currencies.JPY.rate;
      expect(converted).toBeCloseTo(8968.51, 1); // 59.99 * 149.50
    });

    it('should convert USD cents to GBP correctly', () => {
      const priceInCents = 5999; // $59.99
      const priceInUSD = priceInCents / 100;
      const converted = priceInUSD * currencies.GBP.rate;
      expect(converted).toBeCloseTo(47.39, 2); // 59.99 * 0.79
    });

    it('should convert USD cents to EUR correctly', () => {
      const priceInCents = 5999; // $59.99
      const priceInUSD = priceInCents / 100;
      const converted = priceInUSD * currencies.EUR.rate;
      expect(converted).toBeCloseTo(55.19, 2); // 59.99 * 0.92
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
