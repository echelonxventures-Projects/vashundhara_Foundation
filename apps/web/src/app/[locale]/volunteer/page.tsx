import { getTranslations } from 'next-intl/server';
import { Page } from '@/components/cards';
import { Link } from '@/i18n/routing';
export const generateMetadata = async () => ({ title: (await getTranslations('volunteer'))('title') });
export default async function Volunteer() { const t = await getTranslations('volunteer'); return <Page title={t('title')} intro={t('intro')}><Link className="btn btn-primary" href="/register?role=volunteer">{t('start')}</Link></Page>; }
