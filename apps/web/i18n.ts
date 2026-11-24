import { getRequestConfig } from 'next-intl/server'
import path from 'path'

export const locales = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as', 'ur']
export const defaultLocale = 'en'

export const routing = {
  locales,
  defaultLocale,
  localePrefix: 'always' as const
}

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming locale is valid
  if (!locales.includes(locale as any)) locale = defaultLocale

  const messages = (await import(`../../packages/i18n/locales/${locale}.json`)).default
  return { messages, locale }
})