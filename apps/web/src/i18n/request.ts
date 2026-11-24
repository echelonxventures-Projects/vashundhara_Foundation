import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ locale }) => {
  const messages = (await import(`../../packages/i18n/locales/${locale}.json`)).default
  return { messages, locale }
})