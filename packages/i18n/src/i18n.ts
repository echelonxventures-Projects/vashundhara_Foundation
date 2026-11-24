/**
 * i18n Configuration for Vashundhara Foundation Platform
 * Compatible with next-intl and i18next
 */

export const LOCALES = [
  'en', 'hi', 'bn', 'ta', 'te',
  'mr', 'gu', 'kn', 'ml', 'or',
  'pa', 'as', 'ur'
] as const;

export type SupportedLocale = typeof LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const LOCALE_NAMES: Record<SupportedLocale, { english: string; native: string; rtl: boolean }> = {
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

export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  en: '🇺🇸',
  hi: '🇮🇳',
  bn: '🇧🇩',
  ta: '🇮🇳',
  te: '🇮🇳',
  mr: '🇮🇳',
  gu: '🇮🇳',
  kn: '🇮🇳',
  ml: '🇮🇳',
  or: '🇮🇳',
  pa: '🇮🇳',
  as: '🇮🇳',
  ur: '🇵🇰'
};

export function isValidLocale(locale: string): locale is SupportedLocale {
  return LOCALES.includes(locale as SupportedLocale);
}

export function getLocaleDirection(locale: SupportedLocale): 'ltr' | 'rtl' {
  return LOCALE_NAMES[locale].rtl ? 'rtl' : 'ltr';
}

export function getLocaleName(locale: SupportedLocale, inNative = false): string {
  return inNative ? LOCALE_NAMES[locale].native : LOCALE_NAMES[locale].english;
}

export function getLocaleFlag(locale: SupportedLocale): string {
  return LOCALE_FLAGS[locale];
}

// next-intl configuration
export const nextIntlConfig = {
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always' as const
};

// i18next configuration
export const i18nextConfig = {
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: LOCALES,
  defaultNS: 'common',
  ns: [
    'common',
    'auth',
    'dashboard',
    'donations',
    'campaigns',
    'subscriptions',
    'payments',
    'invoices',
    'reports',
    'settings',
    'users',
    'roles',
    'tenants',
    'notifications',
    'webhooks',
    'files',
    'errors',
    'validation'
  ],
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
};

// Translation namespaces
export const TRANSLATION_NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'donations',
  'campaigns',
  'subscriptions',
  'payments',
  'invoices',
  'reports',
  'settings',
  'users',
  'roles',
  'tenants',
  'notifications',
  'webhooks',
  'files',
  'errors',
  'validation'
] as const;

export type TranslationNamespace = typeof TRANSLATION_NAMESPACES[number];

// Date/time formats per locale
export const DATE_FORMATS: Record<SupportedLocale, string> = {
  en: 'MM/dd/yyyy',
  hi: 'dd/MM/yyyy',
  bn: 'dd/MM/yyyy',
  ta: 'dd/MM/yyyy',
  te: 'dd/MM/yyyy',
  mr: 'dd/MM/yyyy',
  gu: 'dd/MM/yyyy',
  kn: 'dd/MM/yyyy',
  ml: 'dd/MM/yyyy',
  or: 'dd/MM/yyyy',
  pa: 'dd/MM/yyyy',
  as: 'dd/MM/yyyy',
  ur: 'dd/MM/yyyy'
};

export const TIME_FORMATS: Record<SupportedLocale, string> = {
  en: 'h:mm a',
  hi: 'hh:mm a',
  bn: 'hh:mm a',
  ta: 'hh:mm a',
  te: 'hh:mm a',
  mr: 'hh:mm a',
  gu: 'hh:mm a',
  kn: 'hh:mm a',
  ml: 'hh:mm a',
  or: 'hh:mm a',
  pa: 'hh:mm a',
  as: 'hh:mm a',
  ur: 'hh:mm a'
};

// Number formats per locale
export const NUMBER_FORMATS: Record<SupportedLocale, Intl.NumberFormatOptions> = {
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

// Pluralization rules (simplified)
export const PLURAL_RULES: Record<SupportedLocale, (n: number) => string> = {
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