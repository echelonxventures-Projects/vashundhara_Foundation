import { getTranslations } from 'next-intl/server';
import { Narrow } from '@/components/cards';
import { FragmentAction } from '@/components/public-forms';
export default async function Newsletter() { const t = await getTranslations(); return <Narrow title={t('home.newsletter')}><FragmentAction path="public/newsletter/confirm" read={['id', 'sig']} busyText={t('common.loading')} okText={t('common.saved')} /></Narrow>; }
