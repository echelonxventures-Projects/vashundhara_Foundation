import { defineRouting } from 'next-intl/routing'
import { LOCALES, DEFAULT_LOCALE } from '@vashundhara-foundation/i18n'

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always'
})