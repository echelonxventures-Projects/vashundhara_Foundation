import { useTranslations } from 'next-intl';
import { Page } from '@/components/cards';
import { Link } from '@/i18n/routing';
export default function NotFound() { const t = useTranslations('common'); return <Page title={t('notFound')} intro={t('notFoundText')}><Link className="btn btn-primary" href="/">{t('home')}</Link></Page>; }
