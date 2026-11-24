import { getTranslations } from 'next-intl/server';
import { EventCard, EventItem, Page } from '@/components/cards';
import { serverApi } from '@/lib/server';
export const generateMetadata = async () => ({ title: (await getTranslations('events'))('title') });
export default async function Events() {
  const [t, d] = await Promise.all([getTranslations(), serverApi<{ items: EventItem[] }>('public/events?limit=60')]);
  return <Page title={t('events.title')}>{d?.items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.items.map((e) => <EventCard key={e.id} e={e} />)}</div> : <p className="text-muted">{t('common.none')}</p>}</Page>;
}
