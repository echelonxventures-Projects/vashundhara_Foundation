/**
 * Utility functions for Vashundhara Foundation Platform
 */
import { type ClassValue } from 'clsx';
import type { Money, FormattedMoney, LocaleCode, Currency } from '../types';
declare global {
    namespace NodeJS {
        interface Timeout {
        }
    }
    function setTimeout(callback: () => void, ms: number): NodeJS.Timeout;
    function clearTimeout(timeout: NodeJS.Timeout): void;
}
/**
 * Tailwind class name merger
 * Combines clsx and tailwind-merge for conditional class names
 */
export declare function cn(...inputs: ClassValue[]): string;
/**
 * Format money amount for display using Currency object (with symbol, decimals, position)
 * Converts minor units to major units with proper formatting
 */
export declare function formatMoney(money: Money, currency: Currency, locale?: LocaleCode): FormattedMoney;
/**
 * Parse money string to minor units using Currency object
 */
export declare function parseMoney(value: string, currency: Currency): Money;
/**
 * Convert money between currencies using exchange rate and Currency objects
 */
export declare function convertMoney(money: Money, exchangeRate: number, targetCurrency: Currency): Money;
/**
 * Format date for locale
 */
export declare function formatDate(date: Date | string, locale?: LocaleCode, options?: Intl.DateTimeFormatOptions): string;
/**
 * Format date time for locale
 */
export declare function formatDateTime(date: Date | string, locale?: LocaleCode, options?: Intl.DateTimeFormatOptions): string;
/**
 * Format relative time (e.g., "2 hours ago")
 */
export declare function formatRelativeTime(date: Date | string, locale?: LocaleCode): string;
/**
 * Generate slug from string
 */
export declare function generateSlug(text: string): string;
/**
 * Truncate text with ellipsis
 */
export declare function truncate(text: string, maxLength: number): string;
/**
 * Capitalize first letter
 */
export declare function capitalize(text: string): string;
/**
 * Convert to title case
 */
export declare function toTitleCase(text: string): string;
/**
 * Generate random string
 */
export declare function randomString(length?: number): string;
/**
 * Generate UUID v4
 */
export declare function generateUuid(): string;
/**
 * Deep clone object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Deep merge objects
 */
export declare function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T;
/**
 * Pick object keys
 */
export declare function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
/**
 * Omit object keys
 */
export declare function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * Debounce function
 */
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Throttle function
 */
export declare function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): (...args: Parameters<T>) => void;
/**
 * Sleep utility
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry utility with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, options?: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    shouldRetry?: (error: unknown) => boolean;
}): Promise<T>;
/**
 * Validate email
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Validate phone (Indian format)
 */
export declare function isValidIndianPhone(phone: string): boolean;
/**
 * Mask sensitive data
 */
export declare function maskEmail(email: string): string;
export declare function maskPhone(phone: string): string;
export declare function maskCardNumber(card: string): string;
/**
 * Format bytes to human readable
 */
export declare function formatBytes(bytes: number, decimals?: number): string;
/**
 * Get initials from name
 */
export declare function getInitials(firstName: string, lastName: string): string;
/**
 * Calculate percentage
 */
export declare function calculatePercentage(value: number, total: number): number;
/**
 * Clamp number between min and max
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Generate random number between min and max (inclusive)
 */
export declare function randomInt(min: number, max: number): number;
//# sourceMappingURL=index.d.ts.map