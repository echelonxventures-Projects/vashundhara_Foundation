"use strict";
/**
 * Core type definitions for Vashundhara Foundation Platform
 * Multi-tenant, Multi-lingual, Multi-currency platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ROLES = exports.TENANT_ROLES = exports.SYSTEM_ROLES = exports.TRANSLATION_NAMESPACES = exports.PLURAL_RULES = exports.NUMBER_FORMATS = exports.TIME_FORMATS = exports.DATE_FORMATS = exports.LOCALE_FLAGS = exports.LOCALE_NAMES = exports.DEFAULT_LOCALE = exports.SUPPORTED_LOCALES = exports.LOCALE_CURRENCY_MAP = exports.SUPPORTED_CURRENCIES = exports.CURRENCY_NAMES = exports.CURRENCY_SYMBOLS = exports.CURRENCY_DECIMALS = exports.PLATFORM_TIER = exports.PLATFORM_TAGLINE = exports.PLATFORM_DOMAIN = exports.PLATFORM_NAME = void 0;
// ============================================
// BRAND CONSTANTS
// ============================================
exports.PLATFORM_NAME = 'Vashundhara Foundation';
exports.PLATFORM_DOMAIN = 'vashundharafoundation.org';
exports.PLATFORM_TAGLINE = "World's First NGO Platform";
exports.PLATFORM_TIER = 'White';
// ============================================
// CONSTANTS
// ============================================
// Type-only exports for constants (values are defined in domain modules)
// These are re-exported from currency/currency.ts and i18n/i18n.ts
var currency_1 = require("../currency/currency");
Object.defineProperty(exports, "CURRENCY_DECIMALS", { enumerable: true, get: function () { return currency_1.CURRENCY_DECIMALS; } });
Object.defineProperty(exports, "CURRENCY_SYMBOLS", { enumerable: true, get: function () { return currency_1.CURRENCY_SYMBOLS; } });
Object.defineProperty(exports, "CURRENCY_NAMES", { enumerable: true, get: function () { return currency_1.CURRENCY_NAMES; } });
Object.defineProperty(exports, "SUPPORTED_CURRENCIES", { enumerable: true, get: function () { return currency_1.SUPPORTED_CURRENCIES; } });
Object.defineProperty(exports, "LOCALE_CURRENCY_MAP", { enumerable: true, get: function () { return currency_1.LOCALE_CURRENCY_MAP; } });
var i18n_1 = require("../i18n/i18n");
Object.defineProperty(exports, "SUPPORTED_LOCALES", { enumerable: true, get: function () { return i18n_1.SUPPORTED_LOCALES; } });
Object.defineProperty(exports, "DEFAULT_LOCALE", { enumerable: true, get: function () { return i18n_1.DEFAULT_LOCALE; } });
Object.defineProperty(exports, "LOCALE_NAMES", { enumerable: true, get: function () { return i18n_1.LOCALE_NAMES; } });
Object.defineProperty(exports, "LOCALE_FLAGS", { enumerable: true, get: function () { return i18n_1.LOCALE_FLAGS; } });
Object.defineProperty(exports, "DATE_FORMATS", { enumerable: true, get: function () { return i18n_1.DATE_FORMATS; } });
Object.defineProperty(exports, "TIME_FORMATS", { enumerable: true, get: function () { return i18n_1.TIME_FORMATS; } });
Object.defineProperty(exports, "NUMBER_FORMATS", { enumerable: true, get: function () { return i18n_1.NUMBER_FORMATS; } });
Object.defineProperty(exports, "PLURAL_RULES", { enumerable: true, get: function () { return i18n_1.PLURAL_RULES; } });
Object.defineProperty(exports, "TRANSLATION_NAMESPACES", { enumerable: true, get: function () { return i18n_1.TRANSLATION_NAMESPACES; } });
exports.SYSTEM_ROLES = [
    'super_admin',
    'system_admin',
    'support_agent'
];
exports.TENANT_ROLES = [
    'tenant_admin',
    'manager',
    'member',
    'viewer',
    'donor',
    'volunteer'
];
exports.ALL_ROLES = [...exports.SYSTEM_ROLES, ...exports.TENANT_ROLES];
//# sourceMappingURL=index.js.map