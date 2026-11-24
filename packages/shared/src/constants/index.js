"use strict";
/**
 * Platform-wide constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER = exports.TENANT = exports.NOTIFICATION = exports.AUDIT = exports.WEBHOOK = exports.FILE_UPLOAD = exports.RATE_LIMITS = exports.CACHE = exports.AUTH = exports.API = exports.PLATFORM = void 0;
exports.PLATFORM = {
    NAME: 'Vashundhara Foundation',
    DOMAIN: 'vashundharafoundation.org',
    TAGLINE: "World's First NGO Platform",
    TIER: 'White',
    VERSION: '1.0.0'
};
exports.API = {
    PREFIX: 'api',
    VERSION: '1',
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
};
exports.AUTH = {
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: 12,
    MFA_ISSUER: 'Vashundhara Foundation'
};
exports.CACHE = {
    DEFAULT_TTL: 60 * 1000, // 1 minute
    TENANT_TTL: 5 * 60 * 1000, // 5 minutes
    EXCHANGE_RATE_TTL: 60 * 60 * 1000, // 1 hour
    TRANSLATION_TTL: 10 * 60 * 1000, // 10 minutes
    FEATURE_FLAG_TTL: 60 * 1000 // 1 minute
};
exports.RATE_LIMITS = {
    AUTH_LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
    AUTH_REGISTER: { limit: 3, windowMs: 15 * 60 * 1000 }, // 3 per 15 min
    AUTH_PASSWORD_RESET: { limit: 2, windowMs: 60 * 60 * 1000 }, // 2 per hour
    API_DEFAULT: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute
    API_UPLOAD: { limit: 10, windowMs: 60 * 1000 }, // 10 per minute
    WEBHOOK: { limit: 1000, windowMs: 60 * 1000 } // 1000 per minute
};
exports.FILE_UPLOAD = {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
    ],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv']
};
exports.WEBHOOK = {
    DEFAULT_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    MAX_PAYLOAD_SIZE: 1024 * 1024 // 1MB
};
exports.AUDIT = {
    RETENTION_DAYS: 365 * 7, // 7 years
    BATCH_SIZE: 100,
    FLUSH_INTERVAL: 5000 // 5 seconds
};
exports.NOTIFICATION = {
    MAX_RETRIES: 3,
    RETRY_DELAYS: [1000, 5000, 30000], // 1s, 5s, 30s
    BATCH_SIZE: 50
};
exports.TENANT = {
    DEFAULT_STATUS: 'PENDING_SETUP',
    DEFAULT_CURRENCY: 'INR',
    DEFAULT_LOCALE: 'en',
    DEFAULT_TIMEZONE: 'Asia/Kolkata',
    SLUG_PATTERN: /^[a-z0-9-]+$/,
    MAX_SLUG_LENGTH: 63
};
exports.USER = {
    DEFAULT_STATUS: 'PENDING_VERIFICATION',
    DEFAULT_LOCALE: 'en',
    DEFAULT_TIMEZONE: 'Asia/Kolkata',
    AVATAR_SIZES: [32, 64, 128, 256]
};
//# sourceMappingURL=index.js.map