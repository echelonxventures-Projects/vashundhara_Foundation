import { formatMinor } from '@vashundhara-foundation/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export interface CampaignItem { id: string; slug: string; title: string; summary: string | null; coverFileId: string | null; goalMinor: number; raisedMinor: number; donations: number; status: string }
export function Progress({ raised, goal, count }: { raised: number; goal: number; count: number }) {
  const t = useTranslations('campaign');
  const locale = useLocale();
  const pct = goal ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return (
    <div>
      {goal > 0 && <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('raised', { amount: formatMinor(raised, 'INR', locale) })}><span style={{ width: `${pct}%` }} /></div>}
      <p className="mt-2"><strong>{t('raised', { amount: formatMinor(raised, 'INR', locale) })}</strong> {goal > 0 && <span className="text-muted">{t('goal', { amount: formatMinor(goal, 'INR', locale) })}</span>}</p>
      <p className="text-sm text-muted">{t('donations', { count })}</p>
    </div>
  );
}
export function CampaignCard({ c }: { c: CampaignItem }) {
  return (
    <article className="card flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {c.coverFileId && <img src={`/api/files/${c.coverFileId}/public`} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-cover" />}
      <h3 className="text-xl font-semibold"><Link href={`/campaigns/${c.slug}`} className="hover:underline">{c.title}</Link></h3>
      {c.summary && <p className="text-muted">{c.summary}</p>}
      <div className="mt-auto"><Progress raised={c.raisedMinor} goal={c.goalMinor} count={c.donations} /></div>
    </article>
  );
}
export interface EventItem { id: string; slug: string; title: string; summary: string | null; venue: string | null; startsAt: string; capacity: number }
export function EventCard({ e }: { e: EventItem }) {
  const locale = useLocale();
  return (
    <article className="card">
      <p className="text-sm text-muted"><time dateTime={e.startsAt}>{new Date(e.startsAt).toLocaleString(locale, { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</time></p>
      <h3 className="mt-1 text-xl font-semibold"><Link href={`/events/${e.slug}`} className="hover:underline">{e.title}</Link></h3>
      {e.summary && <p className="text-muted">{e.summary}</p>}{e.venue && <p className="text-sm">{e.venue}</p>}
    </article>
  );
}
export const Page = ({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) => (
  <div className="mx-auto max-w-6xl px-4 py-10"><h1 className="text-3xl font-bold">{title}</h1>{intro && <p className="mt-2 max-w-2xl text-muted">{intro}</p>}<div className="mt-6">{children}</div></div>
);
export const Narrow = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mx-auto max-w-lg px-4 py-10"><h1 className="mb-6 text-3xl font-bold">{title}</h1>{children}</div>
);
