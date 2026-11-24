/**
 * @vashundhara-foundation/shared - Shared types, utilities, and constants
 */

// Types (only type definitions, constants re-exported from domain modules)
export * from './types';

// Tenant context
export * from './tenant/tenant-context';

// Utilities (general utilities - date, string, validation, etc.)
export {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  generateSlug,
  truncate,
  capitalize,
  toTitleCase,
  randomString,
  generateUuid,
  deepClone,
  deepMerge,
  pick,
  omit,
  debounce,
  throttle,
  sleep,
  retry,
  isValidEmail,
  isValidIndianPhone,
  maskEmail,
  maskPhone,
  maskCardNumber,
  formatBytes,
  getInitials,
  calculatePercentage,
  clamp,
  randomInt
} from './utils';

// Constants
export * from './constants';
export * from './constants/audit-actions';
export * from './constants/notification-channels';
export * from './constants/notification-status';

// Currency utilities (currency constants and money operations)
// Note: Currency constants (CURRENCY_DECIMALS, CURRENCY_SYMBOLS, etc.) are exported from currency/currency
export {
  createMoney,
  createMoneyFromMinor,
  getMajorUnits,
  formatMoney,
  formatMoneySimple,
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  compareMoney,
  isZero,
  isPositive,
  isNegative,
  absMoney,
  convertMoney,
  isValidCurrency,
  getCurrencyInfo,
  getDefaultCurrencyForLocale,
  parseMoneyString,
  roundMoney,
  allocateMoney,
  percentageOf
} from './currency/currency';

// i18n utilities (locale constants and translation helpers)
// Note: Locale constants (SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES, etc.) are exported from types
export {
  isValidLocale,
  getLocaleDirection,
  getLocaleName,
  getLocaleFlag,
  getLocaleFromHeader,
  getLocaleFromPath,
  addLocaleToPath,
  removeLocaleFromPath,
  buildTranslationKey,
  parseTranslationKey,
  flattenTranslations,
  unflattenTranslations
} from './i18n/i18n';

// tRPC Router Types
export * from './trpc';