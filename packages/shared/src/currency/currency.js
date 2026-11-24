"use strict";
/**
 * Currency utilities for Vashundhara Foundation Platform
 * Handles formatting, conversion, and validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_CURRENCIES = exports.LOCALE_CURRENCY_MAP = exports.CURRENCY_NAMES = exports.CURRENCY_SYMBOLS = exports.CURRENCY_DECIMALS = void 0;
exports.createMoney = createMoney;
exports.createMoneyFromMinor = createMoneyFromMinor;
exports.getMajorUnits = getMajorUnits;
exports.formatMoney = formatMoney;
exports.formatMoneySimple = formatMoneySimple;
exports.addMoney = addMoney;
exports.subtractMoney = subtractMoney;
exports.multiplyMoney = multiplyMoney;
exports.divideMoney = divideMoney;
exports.compareMoney = compareMoney;
exports.isZero = isZero;
exports.isPositive = isPositive;
exports.isNegative = isNegative;
exports.absMoney = absMoney;
exports.convertMoney = convertMoney;
exports.isValidCurrency = isValidCurrency;
exports.getCurrencyInfo = getCurrencyInfo;
exports.getDefaultCurrencyForLocale = getDefaultCurrencyForLocale;
exports.parseMoneyString = parseMoneyString;
exports.roundMoney = roundMoney;
exports.allocateMoney = allocateMoney;
exports.percentageOf = percentageOf;
exports.CURRENCY_DECIMALS = {
    USD: 2, INR: 2, EUR: 2, GBP: 2, JPY: 0,
    CAD: 2, AUD: 2, SGD: 2, AED: 2, SAR: 2
};
exports.CURRENCY_SYMBOLS = {
    USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥',
    CAD: 'C$', AUD: 'A$', SGD: 'S$', AED: 'د.إ', SAR: '﷼'
};
exports.CURRENCY_NAMES = {
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
exports.LOCALE_CURRENCY_MAP = {
    en: 'USD', hi: 'INR', bn: 'INR', ta: 'INR', te: 'INR',
    mr: 'INR', gu: 'INR', kn: 'INR', ml: 'INR', or: 'INR',
    pa: 'INR', as: 'INR', ur: 'INR'
};
exports.SUPPORTED_CURRENCIES = [
    'USD', 'INR', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'SAR'
];
/**
 * Create a Money object from major units (e.g., 100.50 USD)
 */
function createMoney(amount, currency) {
    const decimals = exports.CURRENCY_DECIMALS[currency] || 2;
    const minorUnits = Math.round(amount * Math.pow(10, decimals));
    return { amount: minorUnits, currency };
}
/**
 * Create a Money object from minor units (e.g., 10050 paise for INR)
 */
function createMoneyFromMinor(amount, currency) {
    return { amount, currency };
}
/**
 * Get major units from Money (e.g., 100.50 from 10050 paise)
 */
function getMajorUnits(money) {
    const decimals = exports.CURRENCY_DECIMALS[money.currency] || 2;
    return money.amount / Math.pow(10, decimals);
}
/**
 * Format money for display using Intl.NumberFormat
 */
function formatMoney(money, locale = 'en', options = {}) {
    const majorUnits = getMajorUnits(money);
    const currency = money.currency;
    const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: exports.CURRENCY_DECIMALS[currency],
        maximumFractionDigits: exports.CURRENCY_DECIMALS[currency],
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
function formatMoneySimple(money, locale = 'en') {
    return formatMoney(money, locale).amount;
}
/**
 * Add two Money objects (must be same currency)
 */
function addMoney(a, b) {
    if (a.currency !== b.currency) {
        throw new Error(`Cannot add different currencies: ${a.currency} + ${b.currency}`);
    }
    return { amount: a.amount + b.amount, currency: a.currency };
}
/**
 * Subtract two Money objects (must be same currency)
 */
function subtractMoney(a, b) {
    if (a.currency !== b.currency) {
        throw new Error(`Cannot subtract different currencies: ${a.currency} - ${b.currency}`);
    }
    return { amount: a.amount - b.amount, currency: a.currency };
}
/**
 * Multiply Money by a number
 */
function multiplyMoney(money, factor) {
    return { amount: Math.round(money.amount * factor), currency: money.currency };
}
/**
 * Divide Money by a number
 */
function divideMoney(money, divisor) {
    return { amount: Math.round(money.amount / divisor), currency: money.currency };
}
/**
 * Compare two Money objects
 */
function compareMoney(a, b) {
    if (a.currency !== b.currency) {
        throw new Error(`Cannot compare different currencies: ${a.currency} vs ${b.currency}`);
    }
    return a.amount - b.amount;
}
/**
 * Check if money is zero
 */
function isZero(money) {
    return money.amount === 0;
}
/**
 * Check if money is positive
 */
function isPositive(money) {
    return money.amount > 0;
}
/**
 * Check if money is negative
 */
function isNegative(money) {
    return money.amount < 0;
}
/**
 * Get absolute value of money
 */
function absMoney(money) {
    return { amount: Math.abs(money.amount), currency: money.currency };
}
/**
 * Convert money using exchange rate
 */
function convertMoney(money, rate, targetCurrency) {
    const majorUnits = getMajorUnits(money);
    const convertedMajor = majorUnits * rate;
    return createMoney(convertedMajor, targetCurrency);
}
/**
 * Validate currency code
 */
function isValidCurrency(code) {
    return exports.SUPPORTED_CURRENCIES.includes(code);
}
/**
 * Get currency info
 */
function getCurrencyInfo(currency) {
    return {
        code: currency,
        symbol: exports.CURRENCY_SYMBOLS[currency],
        decimals: exports.CURRENCY_DECIMALS[currency],
        name: exports.CURRENCY_NAMES[currency],
        nameSingular: exports.CURRENCY_NAMES[currency].singular,
        namePlural: exports.CURRENCY_NAMES[currency].plural
    };
}
/**
 * Get default currency for locale
 */
function getDefaultCurrencyForLocale(locale) {
    return exports.LOCALE_CURRENCY_MAP[locale] || 'USD';
}
/**
 * Parse money string to Money object
 * e.g., "₹1,000.00" -> { amount: 100000, currency: 'INR' }
 */
function parseMoneyString(str, currency) {
    const symbol = exports.CURRENCY_SYMBOLS[currency];
    const cleanStr = str.replace(new RegExp(`[${symbol}\\s,]`, 'g'), '');
    const amount = parseFloat(cleanStr);
    if (isNaN(amount))
        return null;
    return createMoney(amount, currency);
}
/**
 * Round money to currency's decimal places
 */
function roundMoney(money) {
    const decimals = exports.CURRENCY_DECIMALS[money.currency] || 2;
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
function allocateMoney(money, ratios) {
    const totalRatio = ratios.reduce((a, b) => a + b, 0);
    const results = [];
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
function percentageOf(money, percent) {
    return multiplyMoney(money, percent / 100);
}
//# sourceMappingURL=currency.js.map