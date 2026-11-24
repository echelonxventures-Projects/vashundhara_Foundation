/**
 * Platform-wide constants
 */

export const PLATFORM = {
  NAME: 'Vashundhara Foundation',
  DOMAIN: 'vashundharafoundation.org',
  TAGLINE: "World's First NGO Platform",
  TIER: 'White' as const,
  VERSION: '1.0.0'
} as const;

export const API = {
  PREFIX: 'api',
  VERSION: '1',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
} as const;

export const AUTH = {
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  MFA_ISSUER: 'Vashundhara Foundation'
} as const;

export const CACHE = {
  DEFAULT_TTL: 60 * 1000, // 1 minute
  TENANT_TTL: 5 * 60 * 1000, // 5 minutes
  EXCHANGE_RATE_TTL: 60 * 60 * 1000, // 1 hour
  TRANSLATION_TTL: 10 * 60 * 1000, // 10 minutes
  FEATURE_FLAG_TTL: 60 * 1000 // 1 minute
} as const;

export const RATE_LIMITS = {
  AUTH_LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
  AUTH_REGISTER: { limit: 3, windowMs: 15 * 60 * 1000 }, // 3 per 15 min
  AUTH_PASSWORD_RESET: { limit: 2, windowMs: 60 * 60 * 1000 }, // 2 per hour
  API_DEFAULT: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute
  API_UPLOAD: { limit: 10, windowMs: 60 * 1000 }, // 10 per minute
  WEBHOOK: { limit: 1000, windowMs: 60 * 1000 } // 1000 per minute
} as const;

export const FILE_UPLOAD = {
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
} as const;

export const WEBHOOK = {
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  MAX_PAYLOAD_SIZE: 1024 * 1024 // 1MB
} as const;

export const AUDIT = {
  RETENTION_DAYS: 365 * 7, // 7 years
  BATCH_SIZE: 100,
  FLUSH_INTERVAL: 5000 // 5 seconds
} as const;

export const NOTIFICATION = {
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 5000, 30000], // 1s, 5s, 30s
  BATCH_SIZE: 50
} as const;

export const TENANT = {
  DEFAULT_STATUS: 'PENDING_SETUP' as const,
  DEFAULT_CURRENCY: 'INR' as const,
  DEFAULT_LOCALE: 'en' as const,
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  SLUG_PATTERN: /^[a-z0-9-]+$/,
  MAX_SLUG_LENGTH: 63
} as const;

export const USER = {
  DEFAULT_STATUS: 'PENDING_VERIFICATION' as const,
  DEFAULT_LOCALE: 'en' as const,
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  AVATAR_SIZES: [32, 64, 128, 256] as const
} as const;

