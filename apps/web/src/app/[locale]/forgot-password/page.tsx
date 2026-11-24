import { getTranslations } from 'next-intl/server';
import { ForgotForm } from '@/components/auth-forms';
import { Narrow } from '@/components/cards';
export const generateMetadata = async () => ({ title: (await getTranslations('auth'))('forgot'), robots: { index: false } });
export default async function AuthPage() { const t = await getTranslations('auth'); return <Narrow title={t('forgot')}><ForgotForm /></Narrow>; }
