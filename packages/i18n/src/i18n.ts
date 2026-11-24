export const LOCALES = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as', 'ur'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, { english: string; native: string }> = {
  en: { english: 'English', native: 'English' },
  hi: { english: 'Hindi', native: 'हिन्दी' },
  bn: { english: 'Bengali', native: 'বাংলা' },
  ta: { english: 'Tamil', native: 'தமிழ்' },
  te: { english: 'Telugu', native: 'తెలుగు' },
  mr: { english: 'Marathi', native: 'मराठी' },
  gu: { english: 'Gujarati', native: 'ગુજરાતી' },
  kn: { english: 'Kannada', native: 'ಕನ್ನಡ' },
  ml: { english: 'Malayalam', native: 'മലയാളം' },
  or: { english: 'Odia', native: 'ଓଡ଼ିଆ' },
  pa: { english: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  as: { english: 'Assamese', native: 'অসমীয়া' },
  ur: { english: 'Urdu', native: 'اردو' }
};

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);
export const direction = (l: string): 'ltr' | 'rtl' => (l === 'ur' ? 'rtl' : 'ltr');

export type Messages = { [key: string]: string | Messages };
/** Missing translations fall back to English, so no reader ever sees a raw key. */
export function withFallback(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    if (b === undefined) continue;
    out[k] = typeof v === 'object' && typeof b === 'object' ? withFallback(b, v) : typeof v === typeof b && v !== '' ? v : b;
  }
  return out;
}
