import { DEFAULT_LOCALE, LOCALES } from '@vashundhara-foundation/i18n';
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
export const routing = defineRouting({ locales: LOCALES, defaultLocale: DEFAULT_LOCALE, localePrefix: 'always' });
export const { Link, useRouter, usePathname, redirect } = createNavigation(routing);
