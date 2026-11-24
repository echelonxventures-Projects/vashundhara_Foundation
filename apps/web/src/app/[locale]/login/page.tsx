import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth-forms';
import { Narrow } from '@/components/cards';
export const generateMetadata = async () => ({ title: (await getTranslations('auth'))('login'), robots: { index: false } });
export default async function AuthPage() { const t = await getTranslations('auth'); return <Narrow title={t('login')}><LoginForm /></Narrow>; }
