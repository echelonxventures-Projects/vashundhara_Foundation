"use strict";
/**
 * Utility functions for Vashundhara Foundation Platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.formatMoney = formatMoney;
exports.parseMoney = parseMoney;
exports.convertMoney = convertMoney;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.formatRelativeTime = formatRelativeTime;
exports.generateSlug = generateSlug;
exports.truncate = truncate;
exports.capitalize = capitalize;
exports.toTitleCase = toTitleCase;
exports.randomString = randomString;
exports.generateUuid = generateUuid;
exports.deepClone = deepClone;
exports.deepMerge = deepMerge;
exports.pick = pick;
exports.omit = omit;
exports.debounce = debounce;
exports.throttle = throttle;
exports.sleep = sleep;
exports.retry = retry;
exports.isValidEmail = isValidEmail;
exports.isValidIndianPhone = isValidIndianPhone;
exports.maskEmail = maskEmail;
exports.maskPhone = maskPhone;
exports.maskCardNumber = maskCardNumber;
exports.formatBytes = formatBytes;
exports.getInitials = getInitials;
exports.calculatePercentage = calculatePercentage;
exports.clamp = clamp;
exports.randomInt = randomInt;
/// <reference types="node" />
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
const currency_1 = require("../currency/currency");
/**
 * Tailwind class name merger
 * Combines clsx and tailwind-merge for conditional class names
 */
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
/**
 * Format money amount for display using Currency object (with symbol, decimals, position)
 * Converts minor units to major units with proper formatting
 */
function formatMoney(money, currency, locale = 'en') {
    const { amount, currency: currencyCode } = money;
    const majorAmount = amount / Math.pow(10, currency.decimals);
    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
        currencyDisplay: 'symbol'
    });
    const formatted = formatter.format(majorAmount);
    // Handle symbol position if custom
    if (currency.symbolPosition === 'suffix' && currency.symbol !== formatter.resolvedOptions().currency) {
        const withoutSymbol = formatted.replace(new RegExp(`\\${currency.symbol}\\s*`), '');
        return {
            amount: `${withoutSymbol.trim()} ${currency.symbol}`,
            currency: currencyCode,
            locale
        };
    }
    return {
        amount: formatted,
        currency: currencyCode,
        locale
    };
}
/**
 * Parse money string to minor units using Currency object
 */
function parseMoney(value, currency) {
    // Remove currency symbol and whitespace
    const cleanValue = value
        .replace(new RegExp(`[${currency.symbol}\\s,]`, 'g'), '')
        .trim();
    const majorAmount = parseFloat(cleanValue);
    if (isNaN(majorAmount)) {
        throw new Error(`Invalid money value: ${value}`);
    }
    const minorAmount = Math.round(majorAmount * Math.pow(10, currency.decimals));
    return {
        amount: minorAmount,
        currency: currency.code
    };
}
/**
 * Convert money between currencies using exchange rate and Currency objects
 */
function convertMoney(money, exchangeRate, targetCurrency) {
    // Convert to base (major units)
    const baseAmount = money.amount / Math.pow(10, currency_1.CURRENCY_DECIMALS[money.currency]);
    // Apply exchange rate
    const targetMajorAmount = baseAmount * exchangeRate;
    // Convert to target minor units
    const targetMinorAmount = Math.round(targetMajorAmount * Math.pow(10, targetCurrency.decimals));
    return {
        amount: targetMinorAmount,
        currency: targetCurrency.code
    };
}
/**
 * Format date for locale
 */
function formatDate(date, locale = 'en', options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
}) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, options).format(d);
}
/**
 * Format date time for locale
 */
function formatDateTime(date, locale = 'en', options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
}) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, options).format(d);
}
/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date, locale = 'en') {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diffDays > 0)
        return rtf.format(-diffDays, 'day');
    if (diffHours > 0)
        return rtf.format(-diffHours, 'hour');
    if (diffMins > 0)
        return rtf.format(-diffMins, 'minute');
    return rtf.format(-diffSecs, 'second');
}
/**
 * Generate slug from string
 */
function generateSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
/**
 * Truncate text with ellipsis
 */
function truncate(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - 3) + '...';
}
/**
 * Capitalize first letter
 */
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
/**
 * Convert to title case
 */
function toTitleCase(text) {
    return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}
/**
 * Generate random string
 */
function randomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * Generate UUID v4
 */
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
/**
 * Deep clone object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
/**
 * Deep merge objects
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (sourceValue !== null &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            targetValue !== null &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)) {
            result[key] = deepMerge(targetValue, sourceValue);
        }
        else if (sourceValue !== undefined) {
            result[key] = sourceValue;
        }
    }
    return result;
}
/**
 * Pick object keys
 */
function pick(obj, keys) {
    const result = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}
/**
 * Omit object keys
 */
function omit(obj, keys) {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}
/**
 * Debounce function
 */
function debounce(fn, delay) {
    let timeoutId = null;
    return (...args) => {
        if (timeoutId)
            clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
/**
 * Throttle function
 */
function throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Retry utility with exponential backoff
 */
async function retry(fn, options = {}) {
    const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000, backoffFactor = 2, shouldRetry = () => true } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts || !shouldRetry(error)) {
                throw error;
            }
            const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
            await sleep(delay);
        }
    }
    throw lastError;
}
/**
 * Validate email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Validate phone (Indian format)
 */
function isValidIndianPhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanPhone = phone.replace(/\D/g, '');
    return phoneRegex.test(cleanPhone);
}
/**
 * Mask sensitive data
 */
function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (local.length <= 2)
        return `${local[0]}***@${domain}`;
    return `${local[0]}${''.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}
function maskPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 4)
        return '****';
    return `${'*'.repeat(clean.length - 4)}${clean.slice(-4)}`;
}
function maskCardNumber(card) {
    const clean = card.replace(/\D/g, '');
    if (clean.length < 4)
        return '****';
    return `${'*'.repeat(clean.length - 4)}${clean.slice(-4)}`;
}
/**
 * Format bytes to human readable
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}
/**
 * Get initials from name
 */
function getInitials(firstName, lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
/**
 * Calculate percentage
 */
function calculatePercentage(value, total) {
    if (total === 0)
        return 0;
    return Math.round((value / total) * 100);
}
/**
 * Clamp number between min and max
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
/**
 * Generate random number between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
//# sourceMappingURL=index.js.map