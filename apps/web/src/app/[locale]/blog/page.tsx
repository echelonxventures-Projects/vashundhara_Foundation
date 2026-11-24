import { getTranslations } from 'next-intl/server';
import { Page } from '@/components/cards';
import { Link } from '@/i18n/routing';
import { serverApi } from '@/lib/server';
export const generateMetadata = async () => ({ title: (await getTranslations('nav'))('blog') });
export default async function Blog() {
  const [t, d] = await Promise.all([getTranslations(), serverApi<{ items: { id: string; slug: string; title: string; excerpt: string | null; publishedAt: string }[] }>('public/pages?kind=post&limit=60')]);
  return <Page title={t('nav.blog')}>{d?.items.length ? <div className="grid gap-5 sm:grid-cols-2">{d.items.map((p) => <article key={p.id} className="card"><h2 className="text-xl font-semibold"><Link className="hover:underline" href={`/blog/${p.slug}`}>{p.title}</Link></h2>{p.excerpt && <p>{p.excerpt}</p>}</article>)}</div> : <p className="text-muted">{t('common.none')}</p>}</Page>;
}
