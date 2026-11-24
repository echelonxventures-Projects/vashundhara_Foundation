import { getTranslations } from 'next-intl/server';
import { Page } from '@/components/cards';
import { Library } from '@/components/public-forms';
export const generateMetadata = async () => ({ title: (await getTranslations('library'))('title') });
export default async function LibraryPage() { const t = await getTranslations('library'); return <Page title={t('title')}><Library /></Page>; }
