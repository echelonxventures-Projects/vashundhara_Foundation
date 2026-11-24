import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EventItem } from '@/components/cards';
import { EventForm, Reviews } from '@/components/public-forms';
import { renderMarkdown } from '@/lib/markdown';
import { serverApi } from '@/lib/server';
type E = EventItem & { description: string | null; endsAt: string; status: string; _count: { registrations: number } };
type P = { params: Promise<{ slug: string; locale: string }> };
const load = (slug: string) => serverApi<E>(`public/events/${encodeURIComponent(slug)}`);
export async function generateMetadata({ params }: P): Promise<Metadata> { const e = await load((await params).slug); return e ? { title: e.title, description: e.summary ?? undefined } : {}; }
export default async function Event({ params }: P) {
  const { slug, locale } = await params;
  const [e, t] = await Promise.all([load(slug), getTranslations()]);
  if (!e) notFound();
  const f = (d: string) => new Date(d).toLocaleString(locale, { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
  const open = e.status === 'PUBLISHED' && new Date(e.endsAt) > new Date();
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_380px]">
      <div><h1 className="text-3xl font-bold">{e.title}</h1><dl className="mt-4 grid gap-2"><div><dt className="text-sm text-muted">{t('events.when')}</dt><dd><time dateTime={e.startsAt}>{f(e.startsAt)}</time> – {f(e.endsAt)}</dd></div><div><dt className="text-sm text-muted">{t('events.where')}</dt><dd>{e.venue ?? t('events.online')}</dd></div></dl>
        {e.description && <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(e.description) }} />}<Reviews type="event" id={e.id} /></div>
      <aside className="card h-fit">{open ? <><h2 className="text-xl font-semibold">{t('events.register')}</h2>{e.capacity > 0 && <p className="mb-3 text-muted">{t('events.places', { count: Math.max(0, e.capacity - e._count.registrations) })}</p>}<EventForm slug={e.slug} /></> : <p>{t('events.closed')}</p>}</aside>
    </div>
  );
}
