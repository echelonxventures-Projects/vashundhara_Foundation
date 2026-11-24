/**
 * i18n utilities for Vashundhara Foundation Platform
 * Backend-compatible utilities for translation management
 */
import type { LocaleCode, Translation, TranslationNamespace } from '../types';
export declare const SUPPORTED_LOCALES: LocaleCode[];
export declare const DEFAULT_LOCALE: LocaleCode;
export declare const LOCALE_NAMES: Record<LocaleCode, {
    english: string;
    native: string;
    rtl: boolean;
}>;
export declare const LOCALE_FLAGS: Record<LocaleCode, string>;
export declare const TRANSLATION_NAMESPACES: readonly ["common", "auth", "dashboard", "donations", "campaigns", "subscriptions", "payments", "invoices", "reports", "settings", "users", "roles", "tenants", "notifications", "webhooks", "files", "errors", "validation"];
export type TranslationNamespaceType = typeof TRANSLATION_NAMESPACES[number];
export declare function isValidLocale(locale: string): locale is LocaleCode;
export declare function getLocaleDirection(locale: LocaleCode): 'ltr' | 'rtl';
export declare function getLocaleName(locale: LocaleCode, inNative?: boolean): string;
export declare function getLocaleFlag(locale: LocaleCode): string;
export declare function getLocaleFromHeader(acceptLanguage: string): LocaleCode;
export declare function getLocaleFromPath(pathname: string): LocaleCode | null;
export declare function addLocaleToPath(path: string, locale: LocaleCode): string;
export declare function removeLocaleFromPath(path: string): string;
export declare function buildTranslationKey(namespace: string, key: string): string;
export declare function parseTranslationKey(fullKey: string): {
    namespace: string;
    key: string;
} | null;
export declare function flattenTranslations(translations: Translation[]): TranslationNamespace;
export declare function unflattenTranslations(namespace: string, localeId: string, tenantId: string | undefined, translations: TranslationNamespace): Translation[];
export declare const DATE_FORMATS: Record<LocaleCode, string>;
export declare const TIME_FORMATS: Record<LocaleCode, string>;
export declare const NUMBER_FORMATS: Record<LocaleCode, Intl.NumberFormatOptions>;
export declare const PLURAL_RULES: Record<LocaleCode, (n: number) => string>;
export declare function getPluralForm(locale: LocaleCode, count: number): string;
export declare function formatNumberForLocale(value: number, locale: LocaleCode, options?: Intl.NumberFormatOptions): string;
export declare function formatDateForLocale(date: Date, locale: LocaleCode, options?: Intl.DateTimeFormatOptions): string;
export declare function formatDateTimeForLocale(date: Date, locale: LocaleCode, options?: Intl.DateTimeFormatOptions): string;
export declare function formatRelativeTimeForLocale(date: Date, locale: LocaleCode): string;
export declare const nextIntlConfig: {
    locales: LocaleCode[];
    defaultLocale: "en";
    localePrefix: "always";
};
export declare const i18nextConfig: {
    lng: "en";
    fallbackLng: "en";
    supportedLngs: LocaleCode[];
    defaultNS: string;
    ns: readonly ["common", "auth", "dashboard", "donations", "campaigns", "subscriptions", "payments", "invoices", "reports", "settings", "users", "roles", "tenants", "notifications", "webhooks", "files", "errors", "validation"];
    interpolation: {
        escapeValue: boolean;
    };
    react: {
        useSuspense: boolean;
    };
};
//# sourceMappingURL=i18n.d.ts.map