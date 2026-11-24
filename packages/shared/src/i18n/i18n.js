"use strict";
/**
 * i18n utilities for Vashundhara Foundation Platform
 * Backend-compatible utilities for translation management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.i18nextConfig = exports.nextIntlConfig = exports.PLURAL_RULES = exports.NUMBER_FORMATS = exports.TIME_FORMATS = exports.DATE_FORMATS = exports.TRANSLATION_NAMESPACES = exports.LOCALE_FLAGS = exports.LOCALE_NAMES = exports.DEFAULT_LOCALE = exports.SUPPORTED_LOCALES = void 0;
exports.isValidLocale = isValidLocale;
exports.getLocaleDirection = getLocaleDirection;
exports.getLocaleName = getLocaleName;
exports.getLocaleFlag = getLocaleFlag;
exports.getLocaleFromHeader = getLocaleFromHeader;
exports.getLocaleFromPath = getLocaleFromPath;
exports.addLocaleToPath = addLocaleToPath;
exports.removeLocaleFromPath = removeLocaleFromPath;
exports.buildTranslationKey = buildTranslationKey;
exports.parseTranslationKey = parseTranslationKey;
exports.flattenTranslations = flattenTranslations;
exports.unflattenTranslations = unflattenTranslations;
exports.getPluralForm = getPluralForm;
exports.formatNumberForLocale = formatNumberForLocale;
exports.formatDateForLocale = formatDateForLocale;
exports.formatDateTimeForLocale = formatDateTimeForLocale;
exports.formatRelativeTimeForLocale = formatRelativeTimeForLocale;
exports.SUPPORTED_LOCALES = [
    'en', 'hi', 'bn', 'ta', 'te',
    'mr', 'gu', 'kn', 'ml', 'or',
    'pa', 'as', 'ur'
];
exports.DEFAULT_LOCALE = 'en';
exports.LOCALE_NAMES = {
    en: { english: 'English', native: 'English', rtl: false },
    hi: { english: 'Hindi', native: 'हिन्दी', rtl: false },
    bn: { english: 'Bengali', native: 'বাংলা', rtl: false },
    ta: { english: 'Tamil', native: 'தமிழ்', rtl: false },
    te: { english: 'Telugu', native: 'తెలుగు', rtl: false },
    mr: { english: 'Marathi', native: 'मराठी', rtl: false },
    gu: { english: 'Gujarati', native: 'ગુજરાતી', rtl: false },
    kn: { english: 'Kannada', native: 'ಕನ್ನಡ', rtl: false },
    ml: { english: 'Malayalam', native: 'മലയാളം', rtl: false },
    or: { english: 'Odia', native: 'ଓଡ଼ିଆ', rtl: false },
    pa: { english: 'Punjabi', native: 'ਪੰਜਾਬੀ', rtl: false },
    as: { english: 'Assamese', native: 'অসমীয়া', rtl: false },
    ur: { english: 'Urdu', native: 'اردو', rtl: true }
};
exports.LOCALE_FLAGS = {
    en: '🇺🇸', hi: '🇮🇳', bn: '🇧🇩', ta: '🇮🇳', te: '🇮🇳',
    mr: '🇮🇳', gu: '🇮🇳', kn: '🇮🇳', ml: '🇮🇳', or: '🇮🇳',
    pa: '🇮🇳', as: '🇮🇳', ur: '🇵🇰'
};
exports.TRANSLATION_NAMESPACES = [
    'common', 'auth', 'dashboard', 'donations', 'campaigns',
    'subscriptions', 'payments', 'invoices', 'reports', 'settings',
    'users', 'roles', 'tenants', 'notifications', 'webhooks',
    'files', 'errors', 'validation'
];
function isValidLocale(locale) {
    return exports.SUPPORTED_LOCALES.includes(locale);
}
function getLocaleDirection(locale) {
    return exports.LOCALE_NAMES[locale].rtl ? 'rtl' : 'ltr';
}
function getLocaleName(locale, inNative = false) {
    return inNative ? exports.LOCALE_NAMES[locale].native : exports.LOCALE_NAMES[locale].english;
}
function getLocaleFlag(locale) {
    return exports.LOCALE_FLAGS[locale];
}
function getLocaleFromHeader(acceptLanguage) {
    const langs = acceptLanguage
        .split(',')
        .map(l => l.split(';')[0].trim().toLowerCase())
        .map(l => l.split('-')[0]);
    for (const lang of langs) {
        if (exports.SUPPORTED_LOCALES.includes(lang)) {
            return lang;
        }
    }
    return exports.DEFAULT_LOCALE;
}
function getLocaleFromPath(pathname) {
    const match = pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)(?:\/|$)/);
    if (match && isValidLocale(match[1])) {
        return match[1];
    }
    return null;
}
function addLocaleToPath(path, locale) {
    const cleanPath = path.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/|$)/, '');
    return `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
}
function removeLocaleFromPath(path) {
    return path.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/|$)/, '') || '/';
}
function buildTranslationKey(namespace, key) {
    return `${namespace}.${key}`;
}
function parseTranslationKey(fullKey) {
    const dotIndex = fullKey.indexOf('.');
    if (dotIndex === -1)
        return null;
    return {
        namespace: fullKey.slice(0, dotIndex),
        key: fullKey.slice(dotIndex + 1)
    };
}
function flattenTranslations(translations) {
    const result = {};
    for (const t of translations) {
        const keys = t.key.split('.');
        let current = result;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]])
                current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = t.value;
    }
    return result;
}
function unflattenTranslations(namespace, localeId, tenantId, translations) {
    const result = [];
    function traverse(obj, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'string') {
                result.push({
                    id: '', // Will be generated by DB
                    namespace,
                    key: fullKey,
                    value,
                    localeId,
                    tenantId,
                    context: undefined,
                    isReviewed: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            else if (typeof value === 'object' && value !== null) {
                traverse(value, fullKey);
            }
        }
    }
    traverse(translations);
    return result;
}
exports.DATE_FORMATS = {
    en: 'MM/dd/yyyy', hi: 'dd/MM/yyyy', bn: 'dd/MM/yyyy', ta: 'dd/MM/yyyy', te: 'dd/MM/yyyy',
    mr: 'dd/MM/yyyy', gu: 'dd/MM/yyyy', kn: 'dd/MM/yyyy', ml: 'dd/MM/yyyy', or: 'dd/MM/yyyy',
    pa: 'dd/MM/yyyy', as: 'dd/MM/yyyy', ur: 'dd/MM/yyyy'
};
exports.TIME_FORMATS = {
    en: 'h:mm a', hi: 'hh:mm a', bn: 'hh:mm a', ta: 'hh:mm a', te: 'hh:mm a',
    mr: 'hh:mm a', gu: 'hh:mm a', kn: 'hh:mm a', ml: 'hh:mm a', or: 'hh:mm a',
    pa: 'hh:mm a', as: 'hh:mm a', ur: 'hh:mm a'
};
exports.NUMBER_FORMATS = {
    en: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    hi: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    bn: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    ta: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    te: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    mr: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    gu: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    kn: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    ml: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    or: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    pa: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    as: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    ur: { minimumFractionDigits: 2, maximumFractionDigits: 2 }
};
exports.PLURAL_RULES = {
    en: (n) => n === 1 ? 'one' : 'other',
    hi: (n) => n === 1 ? 'one' : n === 0 ? 'zero' : n === 2 ? 'two' : 'other',
    bn: (n) => n === 1 ? 'one' : 'other',
    ta: (n) => n === 1 ? 'one' : 'other',
    te: (n) => n === 1 ? 'one' : 'other',
    mr: (n) => n === 1 ? 'one' : 'other',
    gu: (n) => n === 1 ? 'one' : 'other',
    kn: (n) => n === 1 ? 'one' : 'other',
    ml: (n) => n === 1 ? 'one' : 'other',
    or: (n) => n === 1 ? 'one' : 'other',
    pa: (n) => n === 1 ? 'one' : 'other',
    as: (n) => n === 1 ? 'one' : 'other',
    ur: (n) => n === 1 ? 'one' : n === 0 ? 'zero' : n === 2 ? 'two' : n > 2 && n < 11 ? 'few' : 'other'
};
function getPluralForm(locale, count) {
    return exports.PLURAL_RULES[locale]?.(count) || 'other';
}
function formatNumberForLocale(value, locale, options = {}) {
    return new Intl.NumberFormat(locale, {
        ...exports.NUMBER_FORMATS[locale],
        ...options
    }).format(value);
}
function formatDateForLocale(date, locale, options = {}) {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    }).format(date);
}
function formatDateTimeForLocale(date, locale, options = {}) {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options
    }).format(date);
}
function formatRelativeTimeForLocale(date, locale) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffSecs) < 60)
        return rtf.format(diffSecs, 'second');
    if (Math.abs(diffMins) < 60)
        return rtf.format(diffMins, 'minute');
    if (Math.abs(diffHours) < 24)
        return rtf.format(diffHours, 'hour');
    return rtf.format(diffDays, 'day');
}
exports.nextIntlConfig = {
    locales: exports.SUPPORTED_LOCALES,
    defaultLocale: exports.DEFAULT_LOCALE,
    localePrefix: 'always'
};
exports.i18nextConfig = {
    lng: exports.DEFAULT_LOCALE,
    fallbackLng: exports.DEFAULT_LOCALE,
    supportedLngs: exports.SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: exports.TRANSLATION_NAMESPACES,
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
};
//# sourceMappingURL=i18n.js.map