/**
 * Currency utilities for Vashundhara Foundation Platform
 * Handles formatting, conversion, and validation
 */

import type { CurrencyCode, Money, FormattedMoney, LocaleCode } from '../types';

export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  USD: 2, INR: 2, EUR: 2, GBP: 2, JPY: 0,
  CAD: 2, AUD: 2, SGD: 2, AED: 2, SAR: 2
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥',
  CAD: 'C$', AUD: 'A$', SGD: 'S$', AED: 'د.إ', SAR: '﷼'
};

export const CURRENCY_NAMES: Record<CurrencyCode, { singular: string; plural: string }> = {
  USD: { singular: 'US Dollar', plural: 'US Dollars' },
  INR: { singular: 'Indian Rupee', plural: 'Indian Rupees' },
  EUR: { singular: 'Euro', plural: 'Euros' },
  GBP: { singular: 'British Pound', plural: 'British Pounds' },
  JPY: { singular: 'Japanese Yen', plural: 'Japanese Yen' },
  CAD: { singular: 'Canadian Dollar', plural: 'Canadian Dollars' },
  AUD: { singular: 'Australian Dollar', plural: 'Australian Dollars' },
  SGD: { singular: 'Singapore Dollar', plural: 'Singapore Dollars' },
  AED: { singular: 'UAE Dirham', plural: 'UAE Dirhams' },
  SAR: { singular: 'Saudi Riyal', plural: 'Saudi Riyals' }
};

export const LOCALE_CURRENCY_MAP: Record<LocaleCode, CurrencyCode> = {
  en: 'USD', hi: 'INR', bn: 'INR', ta: 'INR', te: 'INR',
  mr: 'INR', gu: 'INR', kn: 'INR', ml: 'INR', or: 'INR',
  pa: 'INR', as: 'INR', ur: 'INR'
};

export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  'USD', 'INR', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'SAR'
];

/**
 * Create a Money object from major units (e.g., 100.50 USD)
 */
export function createMoney(amount: number, currency: CurrencyCode): Money {
  const decimals = CURRENCY_DECIMALS[currency] || 2;
  const minorUnits = Math.round(amount * Math.pow(10, decimals));
  return { amount: minorUnits, currency };
}

/**
 * Create a Money object from minor units (e.g., 10050 paise for INR)
 */
export function createMoneyFromMinor(amount: number, currency: CurrencyCode): Money {
  return { amount, currency };
}

/**
 * Get major units from Money (e.g., 100.50 from 10050 paise)
 */
export function getMajorUnits(money: Money): number {
  const decimals = CURRENCY_DECIMALS[money.currency] || 2;
  return money.amount / Math.pow(10, decimals);
}

/**
 * Format money for display using Intl.NumberFormat
 */
export function formatMoney(
  money: Money,
  locale: LocaleCode = 'en',
  options: Intl.NumberFormatOptions = {}
): FormattedMoney {
  const majorUnits = getMajorUnits(money);
  const currency = money.currency;

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: CURRENCY_DECIMALS[currency],
    maximumFractionDigits: CURRENCY_DECIMALS[currency],
    currencyDisplay: 'symbol',
    ...options
  }).format(majorUnits);

  return {
    amount: formatted,
    currency,
    locale
  };
}

/**
 * Format money as a simple string (amount + symbol)
 */
export function formatMoneySimple(money: Money, locale: LocaleCode = 'en'): string {
  return formatMoney(money, locale).amount;
}

/**
 * Add two Money objects (must be same currency)
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add different currencies: ${a.currency} + ${b.currency}`);
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

/**
 * Subtract two Money objects (must be same currency)
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract different currencies: ${a.currency} - ${b.currency}`);
  }
  return { amount: a.amount - b.amount, currency: a.currency };
}

/**
 * Multiply Money by a number
 */
export function multiplyMoney(money: Money, factor: number): Money {
  return { amount: Math.round(money.amount * factor), currency: money.currency };
}

/**
 * Divide Money by a number
 */
export function divideMoney(money: Money, divisor: number): Money {
  return { amount: Math.round(money.amount / divisor), currency: money.currency };
}

/**
 * Compare two Money objects
 */
export function compareMoney(a: Money, b: Money): number {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot compare different currencies: ${a.currency} vs ${b.currency}`);
  }
  return a.amount - b.amount;
}

/**
 * Check if money is zero
 */
export function isZero(money: Money): boolean {
  return money.amount === 0;
}

/**
 * Check if money is positive
 */
export function isPositive(money: Money): boolean {
  return money.amount > 0;
}

/**
 * Check if money is negative
 */
export function isNegative(money: Money): boolean {
  return money.amount < 0;
}

/**
 * Get absolute value of money
 */
export function absMoney(money: Money): Money {
  return { amount: Math.abs(money.amount), currency: money.currency };
}

/**
 * Convert money using exchange rate
 */
export function convertMoney(money: Money, rate: number, targetCurrency: CurrencyCode): Money {
  const majorUnits = getMajorUnits(money);
  const convertedMajor = majorUnits * rate;
  return createMoney(convertedMajor, targetCurrency);
}

/**
 * Validate currency code
 */
export function isValidCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(code as CurrencyCode);
}

/**
 * Get currency info
 */
export function getCurrencyInfo(currency: CurrencyCode) {
  return {
    code: currency,
    symbol: CURRENCY_SYMBOLS[currency],
    decimals: CURRENCY_DECIMALS[currency],
    name: CURRENCY_NAMES[currency],
    nameSingular: CURRENCY_NAMES[currency].singular,
    namePlural: CURRENCY_NAMES[currency].plural
  };
}

/**
 * Get default currency for locale
 */
export function getDefaultCurrencyForLocale(locale: LocaleCode): CurrencyCode {
  return LOCALE_CURRENCY_MAP[locale] || 'USD';
}

/**
 * Parse money string to Money object
 * e.g., "₹1,000.00" -> { amount: 100000, currency: 'INR' }
 */
export function parseMoneyString(str: string, currency: CurrencyCode): Money | null {
  const symbol = CURRENCY_SYMBOLS[currency];
  const cleanStr = str.replace(new RegExp(`[${symbol}\\s,]`, 'g'), '');
  const amount = parseFloat(cleanStr);

  if (isNaN(amount)) return null;
  return createMoney(amount, currency);
}

/**
 * Round money to currency's decimal places
 */
export function roundMoney(money: Money): Money {
  const decimals = CURRENCY_DECIMALS[money.currency] || 2;
  const factor = Math.pow(10, decimals);
  return {
    amount: Math.round(money.amount / factor) * factor,
    currency: money.currency
  };
}

/**
 * Allocate money proportionally (e.g., split 100 among 3 parties)
 * Returns array of Money objects that sum to original
 */
export function allocateMoney(money: Money, ratios: number[]): Money[] {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  const results: Money[] = [];
  let remaining = money.amount;

  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i];
    const isLast = i === ratios.length - 1;
    const allocated = isLast ? remaining : Math.round((money.amount * ratio) / totalRatio);
    results.push({ amount: allocated, currency: money.currency });
    remaining -= allocated;
  }

  return results;
}

/**
 * Calculate percentage of money
 */
export function percentageOf(money: Money, percent: number): Money {
  return multiplyMoney(money, percent / 100);
}