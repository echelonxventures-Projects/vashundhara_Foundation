import { getTranslations } from 'next-intl/server';
import { Page } from '@/components/cards';
import { Link } from '@/i18n/routing';
import { serverApi } from '@/lib/server';
export const generateMetadata = async () => ({ title: (await getTranslations('learn'))('title') });
export default async function Courses() {
  const [t, d] = await Promise.all([getTranslations(), serverApi<{ items: { id: string; title: string; summary: string | null; level: string | null; _count: { lessons: number } }[] }>('learning/courses?limit=60')]);
  return <Page title={t('learn.title')}>{d?.items.length ? <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.items.map((c) => <li key={c.id} className="card"><h2 className="text-xl font-semibold">{c.title}</h2>{c.summary && <p className="text-muted">{c.summary}</p>}<p className="my-2 text-sm">{t('learn.lessons', { count: c._count.lessons })}{c.level ? ` · ${c.level}` : ''}</p><Link className="btn btn-outline" href="/account/learning">{t('learn.enrol')}</Link></li>)}</ul> : <p className="text-muted">{t('common.none')}</p>}</Page>;
}
