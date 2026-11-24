import { getTranslations } from 'next-intl/server';
import { Narrow } from '@/components/cards';
import { DonateForm } from '@/components/donate-form';
import { getTenant } from '@/lib/server';
export const generateMetadata = async () => ({ title: (await getTranslations('donate'))('title') });
export default async function Donate() {
  const [t, tenant] = await Promise.all([getTranslations('donate'), getTenant()]);
  return <Narrow title={t('title')}>{tenant?.status === 'ACTIVE' ? <DonateForm suggested={[]} has80G={tenant.has80G} acceptsForeign={tenant.acceptsForeign} /> : <p>{t('notReady')}</p>}</Narrow>;
}
