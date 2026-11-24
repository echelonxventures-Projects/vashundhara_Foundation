/**
 * Platform-wide constants
 */
export declare const PLATFORM: {
    readonly NAME: "Vashundhara Foundation";
    readonly DOMAIN: "vashundharafoundation.org";
    readonly TAGLINE: "World's First NGO Platform";
    readonly TIER: "White";
    readonly VERSION: "1.0.0";
};
export declare const API: {
    readonly PREFIX: "api";
    readonly VERSION: "1";
    readonly DEFAULT_PAGE_SIZE: 20;
    readonly MAX_PAGE_SIZE: 100;
};
export declare const AUTH: {
    readonly JWT_EXPIRES_IN: "15m";
    readonly JWT_REFRESH_EXPIRES_IN: "7d";
    readonly BCRYPT_ROUNDS: 12;
    readonly MFA_ISSUER: "Vashundhara Foundation";
};
export declare const CACHE: {
    readonly DEFAULT_TTL: number;
    readonly TENANT_TTL: number;
    readonly EXCHANGE_RATE_TTL: number;
    readonly TRANSLATION_TTL: number;
    readonly FEATURE_FLAG_TTL: number;
};
export declare const RATE_LIMITS: {
    readonly AUTH_LOGIN: {
        readonly limit: 5;
        readonly windowMs: number;
    };
    readonly AUTH_REGISTER: {
        readonly limit: 3;
        readonly windowMs: number;
    };
    readonly AUTH_PASSWORD_RESET: {
        readonly limit: 2;
        readonly windowMs: number;
    };
    readonly API_DEFAULT: {
        readonly limit: 100;
        readonly windowMs: number;
    };
    readonly API_UPLOAD: {
        readonly limit: 10;
        readonly windowMs: number;
    };
    readonly WEBHOOK: {
        readonly limit: 1000;
        readonly windowMs: number;
    };
};
export declare const FILE_UPLOAD: {
    readonly MAX_SIZE: number;
    readonly ALLOWED_TYPES: readonly ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"];
    readonly ALLOWED_EXTENSIONS: readonly [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv"];
};
export declare const WEBHOOK: {
    readonly DEFAULT_TIMEOUT: 30000;
    readonly MAX_RETRIES: 3;
    readonly RETRY_DELAY: 1000;
    readonly MAX_PAYLOAD_SIZE: number;
};
export declare const AUDIT: {
    readonly RETENTION_DAYS: number;
    readonly BATCH_SIZE: 100;
    readonly FLUSH_INTERVAL: 5000;
};
export declare const NOTIFICATION: {
    readonly MAX_RETRIES: 3;
    readonly RETRY_DELAYS: readonly [1000, 5000, 30000];
    readonly BATCH_SIZE: 50;
};
export declare const TENANT: {
    readonly DEFAULT_STATUS: "PENDING_SETUP";
    readonly DEFAULT_CURRENCY: "INR";
    readonly DEFAULT_LOCALE: "en";
    readonly DEFAULT_TIMEZONE: "Asia/Kolkata";
    readonly SLUG_PATTERN: RegExp;
    readonly MAX_SLUG_LENGTH: 63;
};
export declare const USER: {
    readonly DEFAULT_STATUS: "PENDING_VERIFICATION";
    readonly DEFAULT_LOCALE: "en";
    readonly DEFAULT_TIMEZONE: "Asia/Kolkata";
    readonly AVATAR_SIZES: readonly [32, 64, 128, 256];
};
//# sourceMappingURL=index.d.ts.map