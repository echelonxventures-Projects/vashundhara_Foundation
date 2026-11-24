'use client';
import { LOCALE_NAMES, Locale } from '@vashundhara-foundation/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useSession } from './session';

export function Header({ name, logoUrl, locales, items }: { name: string; logoUrl: string | null; locales: string[]; items: { href: string; key: string }[] }) {
  const t = useTranslations();
  const path = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { me, loading, logout } = useSession();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const links = (
    <>
      {items.map((i) => <Link key={i.href} href={i.href} aria-current={path.startsWith(i.href) ? 'page' : undefined} className="rounded px-2 py-2 hover:underline aria-[current=page]:font-bold">{t(`nav.${i.key}`)}</Link>)}
      <select aria-label={t('common.language')} className="min-h-[44px] rounded-lg border border-line bg-surface px-2" value={locale} onChange={(e) => router.replace(path, { locale: e.target.value as Locale })}>
        {locales.map((l) => <option key={l} value={l} lang={l}>{LOCALE_NAMES[l as Locale]?.native ?? l}</option>)}
      </select>
      {!loading && (me?.user ? (
        <>
          {me.permissions.length > 0 && <Link href="/staff" className="px-2 py-2 hover:underline">{t('nav.staff')}</Link>}
          <Link href="/account" className="px-2 py-2 hover:underline">{t('nav.account')}</Link>
          <button type="button" className="btn btn-ghost" onClick={async () => { await logout(); router.push('/'); }}>{t('nav.logout')}</button>
        </>
      ) : <Link href="/login" className="px-2 py-2 hover:underline">{t('nav.login')}</Link>)}
      <Link href="/donate" className="btn btn-primary">{t('nav.donate')}</Link>
    </>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-surface">{t('common.skip')}</a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl ?? '/icon.svg'} alt="" width={36} height={36} className="rounded-lg" />{name}
        </Link>
        <nav aria-label={t('common.menu')} className="hidden flex-wrap items-center gap-1 lg:flex">{links}</nav>
        <button type="button" className="btn btn-outline lg:hidden" aria-expanded={open} aria-controls="mnav" onClick={() => setOpen(!open)}>{t('common.menu')}</button>
      </div>
      {open && <nav id="mnav" aria-label={t('common.menu')} className="flex flex-col gap-2 border-t border-line px-4 py-3 lg:hidden">{links}</nav>}
    </header>
  );
}
