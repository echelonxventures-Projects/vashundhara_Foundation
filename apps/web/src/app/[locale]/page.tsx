import { getTranslations } from 'next-intl/server';
import { CampaignCard, CampaignItem, EventCard, EventItem } from '@/components/cards';
import { NewsletterForm } from '@/components/public-forms';
import { Link } from '@/i18n/routing';
import { getTenant, serverApi } from '@/lib/server';

export default async function Home() {
  const [t, tenant, c, e] = await Promise.all([getTranslations(), getTenant(), serverApi<{ items: CampaignItem[] }>('public/campaigns?limit=6'), serverApi<{ items: EventItem[] }>('public/events?limit=3')]);
  const s = tenant?.settings ?? {};
  return (
    <>
      <section className="bg-brand-soft"><div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl">{s.tagline ?? t('home.welcome')}</h1>
        {s.about && <p className="mt-4 max-w-2xl text-lg">{s.about}</p>}
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/donate" className="btn btn-primary">{t('home.donateNow')}</Link><Link href="/campaigns" className="btn btn-outline">{t('home.seeWork')}</Link></div>
      </div></section>
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        {s.impact?.length ? <section aria-labelledby="imp"><h2 id="imp" className="mb-4 text-2xl font-bold">{t('home.impact')}</h2><ul className="grid gap-4 sm:grid-cols-3">{s.impact.map((i) => <li key={i.label} className="card"><p className="text-3xl font-bold">{i.value}</p><p>{i.label}</p><p className="text-sm text-muted">{t('home.source', { source: i.source })}</p></li>)}</ul></section> : null}
        {c?.items.length ? <section aria-labelledby="cam"><h2 id="cam" className="mb-4 text-2xl font-bold">{t('home.active')}</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{c.items.map((x) => <CampaignCard key={x.id} c={x} />)}</div></section> : null}
        {e?.items.length ? <section aria-labelledby="evt"><h2 id="evt" className="mb-4 text-2xl font-bold">{t('home.upcoming')}</h2><div className="grid gap-5 sm:grid-cols-3">{e.items.map((x) => <EventCard key={x.id} e={x} />)}</div></section> : null}
        <section className="grid gap-5 sm:grid-cols-3">
          <div className="card"><h2 className="text-xl font-semibold">{t('home.joinTitle')}</h2><p className="my-2">{t('home.joinText')}</p><Link href="/volunteer" className="btn btn-outline">{t('home.joinCta')}</Link></div>
          <div className="card"><h2 className="text-xl font-semibold">{t('home.helpTitle')}</h2><p className="my-2">{t('home.helpText')}</p><Link href="/account/support" className="btn btn-outline">{t('home.helpCta')}</Link></div>
          <div className="card"><NewsletterForm /></div>
        </section>
      </div>
    </>
  );
}
