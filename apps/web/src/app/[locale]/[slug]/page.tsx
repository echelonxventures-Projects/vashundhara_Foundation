import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { defaultPage } from '@/lib/legal';
import { renderMarkdown } from '@/lib/markdown';
import { getTenant, serverApi } from '@/lib/server';
type P = { params: Promise<{ slug: string; locale: string }> };
type Pg = { title: string; excerpt: string | null; body: string; locale: string };
async function load(slug: string, locale: string): Promise<Pg | null> {
  const p = await serverApi<Pg>(`public/pages/${encodeURIComponent(slug)}?locale=${locale}`);
  if (p) return p;
  const t = await getTenant();
  const d = t && defaultPage(slug, t);
  return d ? { ...d, excerpt: null, locale: 'en' } : null;
}
export async function generateMetadata({ params }: P): Promise<Metadata> { const { slug, locale } = await params; const p = await load(slug, locale); return p ? { title: p.title, description: p.excerpt ?? undefined } : {}; }
export default async function CmsPage({ params }: P) {
  const { slug, locale } = await params;
  const p = await load(slug, locale);
  if (!p) {
    const r = await serverApi<{ to: string | null }>(`public/redirect?path=${encodeURIComponent(`/${slug}`)}`);
    if (r?.to) permanentRedirect(r.to);
    notFound();
  }
  return <article lang={p.locale} className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-3xl font-bold">{p.title}</h1><div className="prose mt-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.body) }} /></article>;
}
