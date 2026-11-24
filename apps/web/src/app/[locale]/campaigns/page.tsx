import { getTranslations } from 'next-intl/server';
import { CampaignCard, CampaignItem, Page } from '@/components/cards';
import { serverApi } from '@/lib/server';
export const generateMetadata = async () => ({ title: (await getTranslations('nav'))('campaigns') });
export default async function Campaigns() {
  const [t, d] = await Promise.all([getTranslations(), serverApi<{ items: CampaignItem[] }>('public/campaigns?limit=60')]);
  return <Page title={t('nav.campaigns')}>{d?.items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.items.map((c) => <CampaignCard key={c.id} c={c} />)}</div> : <p className="text-muted">{t('common.none')}</p>}</Page>;
}
