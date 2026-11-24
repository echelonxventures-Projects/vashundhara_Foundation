import { direction, isLocale, LOCALES } from '@vashundhara-foundation/i18n';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { SessionProvider } from '@/components/session';
import { Link } from '@/i18n/routing';
import { getFlags, getTenant } from '@/lib/server';
import '@vashundhara-foundation/ui/src/styles.css';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ locale: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTenant();
  const name = t?.name ?? 'NGO';
  const path = ((await headers()).get('x-vf-path') ?? `/${locale}`).replace(/^\/[a-z]{2}(?=\/|$)/, '');
  return {
    metadataBase: t ? new URL(t.url) : undefined, title: { default: name, template: `%s | ${name}` }, description: t?.settings.tagline ?? t?.description ?? undefined,
    alternates: t ? { canonical: `/${locale}${path}`, languages: Object.fromEntries(t.supportedLocales.map((l) => [l, `/${l}${path}`])) } : undefined,
    openGraph: { siteName: name, locale, type: 'website' }, icons: { icon: t?.logoUrl ?? '/icon.svg' }
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Picks black or white text so any brand colour stays readable. */
function brandStyle(hex?: string) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { '--brand': hex, '--brand-ink': lum > 0.179 ? '#000000' : '#ffffff' } as React.CSSProperties;
}

export default async function Layout({ children, params }: P) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const [tenant, flags, t] = await Promise.all([getTenant(), getFlags(), getTranslations()]);
  const s = tenant?.settings ?? {};
  const on = (k: string) => flags[`module.${k}`] !== false;
  const items = [{ href: '/campaigns', key: 'campaigns' }, ...(on('events') ? [{ href: '/events', key: 'events' }] : []), ...(on('learning') ? [{ href: '/courses', key: 'learn' }] : []), ...(on('library') ? [{ href: '/library', key: 'library' }] : []), ...(on('volunteering') ? [{ href: '/volunteer', key: 'volunteer' }] : []), { href: '/blog', key: 'blog' }, { href: '/contact', key: 'contact' }];
  return (
    <html lang={locale} dir={direction(locale)} style={brandStyle(s.primaryColor)}>
      <body>
        <NextIntlClientProvider>
          <SessionProvider>
            <Header name={tenant?.name ?? 'NGO'} logoUrl={tenant?.logoUrl ?? null} locales={tenant?.supportedLocales?.length ? tenant.supportedLocales : [...LOCALES]} items={items} />
            <main id="main" className="min-h-[60vh]">{children}</main>
            <footer className="mt-12 border-t border-line">
              <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
                <div><p className="font-semibold">{tenant?.name}</p>{s.contactAddress && <p className="text-muted">{s.contactAddress}</p>}{s.contactEmail && <p><a className="underline" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></p>}{s.contactPhone && <p><a className="underline" href={`tel:${s.contactPhone}`}>{s.contactPhone}</a></p>}</div>
                <nav aria-label="Footer" className="grid gap-1">{([['/about', 'about'], ['/privacy', 'privacy'], ['/terms', 'terms'], ['/refunds', 'refunds'], ['/register-ngo', 'forNgos']] as const).map(([h, k]) => <Link key={h} href={h} className="hover:underline">{t(`nav.${k}`)}</Link>)}</nav>
                <div className="grid content-start gap-1">{(['facebook', 'instagram', 'youtube', 'linkedin'] as const).map((k) => s[k] && <a key={k} href={s[k]} rel="noopener" className="capitalize hover:underline">{k}</a>)}</div>
              </div>
              <p className="mx-auto max-w-6xl px-4 pb-8 text-sm text-muted">{tenant?.legalName && t('footer.legal', { name: tenant.legalName, reg: tenant.registrationNo ?? '-' })} {tenant?.has80G && t('footer.taxNote')}</p>
            </footer>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
