import { getTranslations } from 'next-intl/server';
import { ResendForm } from '@/components/auth-forms';
import { Narrow } from '@/components/cards';
import { FragmentAction } from '@/components/public-forms';
import { Link } from '@/i18n/routing';
export default async function Verify() { const t = await getTranslations('auth'); return <Narrow title={t('verifying')}><FragmentAction path="auth/verify-email" read={['token']} busyText={t('verifying')} okText={t('verified')} /><p className="my-4"><Link className="btn btn-primary" href="/login">{t('login')}</Link></p><ResendForm /></Narrow>; }
