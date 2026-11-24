"use strict";
/**
 * @vashundhara-foundation/shared - Shared types, utilities, and constants
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomInt = exports.clamp = exports.calculatePercentage = exports.getInitials = exports.formatBytes = exports.maskCardNumber = exports.maskPhone = exports.maskEmail = exports.isValidIndianPhone = exports.isValidEmail = exports.retry = exports.sleep = exports.throttle = exports.debounce = exports.omit = exports.pick = exports.deepMerge = exports.deepClone = exports.generateUuid = exports.randomString = exports.toTitleCase = exports.capitalize = exports.truncate = exports.generateSlug = exports.formatRelativeTime = exports.formatDateTime = exports.formatDate = exports.cn = void 0;
// Types (only type definitions, constants re-exported from domain modules)
__exportStar(require("./types"), exports);
// Tenant context
__exportStar(require("./tenant/tenant-context"), exports);
// Utilities (general utilities - date, string, validation, etc.)
var utils_1 = require("./utils");
Object.defineProperty(exports, "cn", { enumerable: true, get: function () { return utils_1.cn; } });
Object.defineProperty(exports, "formatDate", { enumerable: true, get: function () { return utils_1.formatDate; } });
Object.defineProperty(exports, "formatDateTime", { enumerable: true, get: function () { return utils_1.formatDateTime; } });
Object.defineProperty(exports, "formatRelativeTime", { enumerable: true, get: function () { return utils_1.formatRelativeTime; } });
Object.defineProperty(exports, "generateSlug", { enumerable: true, get: function () { return utils_1.generateSlug; } });
Object.defineProperty(exports, "truncate", { enumerable: true, get: function () { return utils_1.truncate; } });
Object.defineProperty(exports, "capitalize", { enumerable: true, get: function () { return utils_1.capitalize; } });
Object.defineProperty(exports, "toTitleCase", { enumerable: true, get: function () { return utils_1.toTitleCase; } });
Object.defineProperty(exports, "randomString", { enumerable: true, get: function () { return utils_1.randomString; } });
Object.defineProperty(exports, "generateUuid", { enumerable: true, get: function () { return utils_1.generateUuid; } });
Object.defineProperty(exports, "deepClone", { enumerable: true, get: function () { return utils_1.deepClone; } });
Object.defineProperty(exports, "deepMerge", { enumerable: true, get: function () { return utils_1.deepMerge; } });
Object.defineProperty(exports, "pick", { enumerable: true, get: function () { return utils_1.pick; } });
Object.defineProperty(exports, "omit", { enumerable: true, get: function () { return utils_1.omit; } });
Object.defineProperty(exports, "debounce", { enumerable: true, get: function () { return utils_1.debounce; } });
Object.defineProperty(exports, "throttle", { enumerable: true, get: function () { return utils_1.throttle; } });
Object.defineProperty(exports, "sleep", { enumerable: true, get: function () { return utils_1.sleep; } });
Object.defineProperty(exports, "retry", { enumerable: true, get: function () { return utils_1.retry; } });
Object.defineProperty(exports, "isValidEmail", { enumerable: true, get: function () { return utils_1.isValidEmail; } });
Object.defineProperty(exports, "isValidIndianPhone", { enumerable: true, get: function () { return utils_1.isValidIndianPhone; } });
Object.defineProperty(exports, "maskEmail", { enumerable: true, get: function () { return utils_1.maskEmail; } });
Object.defineProperty(exports, "maskPhone", { enumerable: true, get: function () { return utils_1.maskPhone; } });
Object.defineProperty(exports, "maskCardNumber", { enumerable: true, get: function () { return utils_1.maskCardNumber; } });
Object.defineProperty(exports, "formatBytes", { enumerable: true, get: function () { return utils_1.formatBytes; } });
Object.defineProperty(exports, "getInitials", { enumerable: true, get: function () { return utils_1.getInitials; } });
Object.defineProperty(exports, "calculatePercentage", { enumerable: true, get: function () { return utils_1.calculatePercentage; } });
Object.defineProperty(exports, "clamp", { enumerable: true, get: function () { return utils_1.clamp; } });
Object.defineProperty(exports, "randomInt", { enumerable: true, get: function () { return utils_1.randomInt; } });
// Constants
__exportStar(require("./constants"), exports);
// Currency utilities (currency constants and money operations)
__exportStar(require("./currency/currency"), exports);
// i18n utilities (locale constants and translation helpers)
__exportStar(require("./i18n/i18n"), exports);
//# sourceMappingURL=index.js.map