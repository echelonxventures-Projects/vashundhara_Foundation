/**
 * Currency utilities for Vashundhara Foundation Platform
 * Handles formatting, conversion, and validation
 */
import type { CurrencyCode, Money, FormattedMoney, LocaleCode } from '../types';
export declare const CURRENCY_DECIMALS: Record<CurrencyCode, number>;
export declare const CURRENCY_SYMBOLS: Record<CurrencyCode, string>;
export declare const CURRENCY_NAMES: Record<CurrencyCode, {
    singular: string;
    plural: string;
}>;
export declare const LOCALE_CURRENCY_MAP: Record<LocaleCode, CurrencyCode>;
export declare const SUPPORTED_CURRENCIES: CurrencyCode[];
/**
 * Create a Money object from major units (e.g., 100.50 USD)
 */
export declare function createMoney(amount: number, currency: CurrencyCode): Money;
/**
 * Create a Money object from minor units (e.g., 10050 paise for INR)
 */
export declare function createMoneyFromMinor(amount: number, currency: CurrencyCode): Money;
/**
 * Get major units from Money (e.g., 100.50 from 10050 paise)
 */
export declare function getMajorUnits(money: Money): number;
/**
 * Format money for display using Intl.NumberFormat
 */
export declare function formatMoney(money: Money, locale?: LocaleCode, options?: Intl.NumberFormatOptions): FormattedMoney;
/**
 * Format money as a simple string (amount + symbol)
 */
export declare function formatMoneySimple(money: Money, locale?: LocaleCode): string;
/**
 * Add two Money objects (must be same currency)
 */
export declare function addMoney(a: Money, b: Money): Money;
/**
 * Subtract two Money objects (must be same currency)
 */
export declare function subtractMoney(a: Money, b: Money): Money;
/**
 * Multiply Money by a number
 */
export declare function multiplyMoney(money: Money, factor: number): Money;
/**
 * Divide Money by a number
 */
export declare function divideMoney(money: Money, divisor: number): Money;
/**
 * Compare two Money objects
 */
export declare function compareMoney(a: Money, b: Money): number;
/**
 * Check if money is zero
 */
export declare function isZero(money: Money): boolean;
/**
 * Check if money is positive
 */
export declare function isPositive(money: Money): boolean;
/**
 * Check if money is negative
 */
export declare function isNegative(money: Money): boolean;
/**
 * Get absolute value of money
 */
export declare function absMoney(money: Money): Money;
/**
 * Convert money using exchange rate
 */
export declare function convertMoney(money: Money, rate: number, targetCurrency: CurrencyCode): Money;
/**
 * Validate currency code
 */
export declare function isValidCurrency(code: string): code is CurrencyCode;
/**
 * Get currency info
 */
export declare function getCurrencyInfo(currency: CurrencyCode): {
    code: CurrencyCode;
    symbol: string;
    decimals: number;
    name: {
        singular: string;
        plural: string;
    };
    nameSingular: string;
    namePlural: string;
};
/**
 * Get default currency for locale
 */
export declare function getDefaultCurrencyForLocale(locale: LocaleCode): CurrencyCode;
/**
 * Parse money string to Money object
 * e.g., "₹1,000.00" -> { amount: 100000, currency: 'INR' }
 */
export declare function parseMoneyString(str: string, currency: CurrencyCode): Money | null;
/**
 * Round money to currency's decimal places
 */
export declare function roundMoney(money: Money): Money;
/**
 * Allocate money proportionally (e.g., split 100 among 3 parties)
 * Returns array of Money objects that sum to original
 */
export declare function allocateMoney(money: Money, ratios: number[]): Money[];
/**
 * Calculate percentage of money
 */
export declare function percentageOf(money: Money, percent: number): Money;
//# sourceMappingURL=currency.d.ts.map