import { formatMinor } from '@vashundhara-foundation/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CampaignItem, Progress } from '@/components/cards';
import { DonateForm } from '@/components/donate-form';
import { Reviews } from '@/components/public-forms';
import { renderMarkdown } from '@/lib/markdown';
import { getTenant, serverApi } from '@/lib/server';
type C = CampaignItem & { story: string | null; suggestedAmounts: number[]; is80GEligible: boolean; recent: { name: string | null; amountMinor: number | null; message: string | null }[] };
type P = { params: Promise<{ slug: string; locale: string }> };
const load = (slug: string) => serverApi<C>(`public/campaigns/${encodeURIComponent(slug)}`);
export async function generateMetadata({ params }: P): Promise<Metadata> { const c = await load((await params).slug); return c ? { title: c.title, description: c.summary ?? undefined, openGraph: c.coverFileId ? { images: [`/api/files/${c.coverFileId}/public`] } : undefined } : {}; }
export default async function Campaign({ params }: P) {
  const { slug, locale } = await params;
  const [c, tenant, t] = await Promise.all([load(slug), getTenant(), getTranslations()]);
  if (!c) notFound();
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_400px]">
      <div>
        <h1 className="text-3xl font-bold">{c.title}</h1>{c.summary && <p className="mt-2 text-lg text-muted">{c.summary}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.coverFileId && <img src={`/api/files/${c.coverFileId}/public`} alt="" className="mt-4 w-full rounded-xl" />}
        {c.story && <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.story) }} />}
        {c.recent.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">{t('campaign.recent')}</h2><ul className="mt-2 divide-y divide-line">{c.recent.map((r, i) => <li key={i} className="py-2"><strong>{r.name ?? t('campaign.anonymous')}</strong> {r.amountMinor !== null && formatMinor(r.amountMinor, 'INR', locale)}{r.message && <p className="text-muted">{r.message}</p>}</li>)}</ul></section>}
        <Reviews type="campaign" id={c.id} />
      </div>
      <aside className="card h-fit"><Progress raised={c.raisedMinor} goal={c.goalMinor} count={c.donations} /><hr className="my-4 border-line" />
        {c.status === 'ACTIVE' ? <><h2 className="mb-3 text-xl font-semibold">{t('campaign.give')}</h2><DonateForm campaignSlug={c.slug} suggested={c.suggestedAmounts} has80G={tenant?.has80G ?? false} acceptsForeign={tenant?.acceptsForeign ?? false} is80GEligible={c.is80GEligible} /></> : <p>{t(c.status === 'PAUSED' ? 'campaign.paused' : 'campaign.ended')}</p>}
      </aside>
    </div>
  );
}
