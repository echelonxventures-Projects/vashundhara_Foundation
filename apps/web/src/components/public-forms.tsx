'use client';
import { Feedback, Notice, post, useAction, useApi, api } from '@vashundhara-foundation/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { TextArea, TextField, values } from './forms';
import { useSession } from './session';

export function ContactForm() {
  const t = useTranslations();
  const a = useAction();
  return (
    <form onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; if (await a.run(() => post('public/contact', values(f)), t('contact.sent'))) f.reset(); }}>
      <Feedback action={a} />
      <TextField name="name" label={t('common.name')} required autoComplete="name" maxLength={100} />
      <TextField name="email" type="email" label={t('common.email')} required autoComplete="email" />
      <TextField name="phone" type="tel" label={`${t('common.phone')} (${t('common.optional')})`} autoComplete="tel" />
      <TextArea name="message" label={t('common.message')} required maxLength={5000} />
      <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <button className="btn btn-primary" disabled={a.busy}>{t('common.send')}</button>
    </form>
  );
}
export function NewsletterForm() {
  const t = useTranslations();
  const a = useAction();
  return (
    <form onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; if (await a.run(() => post('public/newsletter', values(f)), t('home.subscribed'))) f.reset(); }}>
      <TextField name="email" type="email" label={t('home.newsletter')} required autoComplete="email" />
      <Feedback action={a} /><button className="btn btn-outline" disabled={a.busy}>{t('home.subscribe')}</button>
    </form>
  );
}
export function EventForm({ slug }: { slug: string }) {
  const t = useTranslations();
  const a = useAction();
  if (a.done) return <Notice kind="ok">{a.done}</Notice>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void a.run(() => post(`public/events/${slug}/register`, values(e.currentTarget)), t('events.registered')); }}>
      <Feedback action={a} />
      <TextField name="name" label={t('common.name')} required autoComplete="name" />
      <TextField name="email" type="email" label={t('common.email')} required autoComplete="email" />
      <TextField name="phone" type="tel" label={`${t('common.phone')} (${t('common.optional')})`} autoComplete="tel" />
      <button className="btn btn-primary" disabled={a.busy}>{t('events.register')}</button>
    </form>
  );
}
export function Reviews({ type, id }: { type: string; id: string }) {
  const t = useTranslations();
  const { me } = useSession();
  const { data, reload } = useApi<{ items: { authorName: string; rating: number; comment: string; reply: string | null }[]; average: number | null; count: number }>(`feedback/public/${type}/${id}`);
  const a = useAction();
  const [rating, setRating] = useState(5);
  if (!data || (!data.count && !me?.user)) return null;
  return (
    <section aria-labelledby="rv" className="mt-10">
      <h2 id="rv" className="text-2xl font-semibold">{t('home.reviews')} {data.average !== null && <span className="text-muted">({data.average}/5, {data.count})</span>}</h2>
      <ul className="mt-3 grid gap-3">{data.items.filter((i) => i.comment).map((i, n) => <li key={n} className="card"><p>{'★'.repeat(i.rating)}<span className="sr-only">{i.rating}/5</span> <span className="text-muted">{i.authorName}</span></p><p>{i.comment}</p>{i.reply && <p className="mt-2 border-s-4 border-line ps-3 text-muted">{i.reply}</p>}</li>)}</ul>
      {me?.user && (
        <form className="card mt-4" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; void a.run(async () => { await post('feedback', { subjectType: type, subjectId: id, rating, comment: values(f).comment }); await reload(); }, t('common.saved')); }}>
          <fieldset className="mb-3 flex gap-3"><legend className="sr-only">1-5</legend>{[1, 2, 3, 4, 5].map((n) => <label key={n} className="flex items-center gap-1"><input type="radio" name="rating" checked={rating === n} onChange={() => setRating(n)} />{n}★</label>)}</fieldset>
          <TextArea name="comment" label={`${t('common.message')} (${t('common.optional')})`} maxLength={2000} /><Feedback action={a} /><button className="btn btn-outline" disabled={a.busy}>{t('common.send')}</button>
        </form>
      )}
    </section>
  );
}
export function Library() {
  const t = useTranslations();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [cat, setCat] = useState('');
  useEffect(() => { const x = setTimeout(() => setTerm(q), 300); return () => clearTimeout(x); }, [q]);
  const { data } = useApi<{ items: { id: string; title: string; author: string | null; description: string | null }[]; categories: string[] }>(`learning/library?limit=100&q=${encodeURIComponent(term)}&category=${encodeURIComponent(cat)}`);
  const a = useAction();
  const open = (id: string) => a.run(async () => { const { url } = await api<{ url: string }>(`learning/library/${id}/open`, { method: 'POST', body: {} }); window.location.assign(url); });
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3"><input className="input max-w-sm" type="search" aria-label={t('common.search')} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-xs" aria-label={t('library.title')} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{t('library.all')}</option>{data?.categories.map((c) => <option key={c}>{c}</option>)}</select></div>
      <Feedback action={a} />
      {data && !data.items.length && <p className="text-muted">{t('common.none')}</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data?.items.map((i) => <li key={i.id} className="card"><h2 className="text-lg font-semibold">{i.title}</h2>{i.author && <p className="text-muted">{t('library.by', { author: i.author })}</p>}{i.description && <p className="mt-2">{i.description}</p>}<button className="btn btn-outline mt-3" onClick={() => open(i.id)} disabled={a.busy}>{t('library.read')}</button></li>)}</ul>
    </>
  );
}
export function FragmentAction({ path, read, busyText, okText }: { path: string; read: string[]; busyText: string; okText: string }) {
  const t = useTranslations('auth');
  const [state, setState] = useState<'busy' | 'ok' | 'bad'>('busy');
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const body = Object.fromEntries(read.map((k) => [k, p.get(k) ?? '']));
    window.history.replaceState(null, '', window.location.pathname);
    post(path, body).then(() => setState('ok')).catch(() => setState('bad'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state === 'busy' ? <p role="status">{busyText}</p> : <Notice kind={state === 'ok' ? 'ok' : 'error'}>{state === 'ok' ? okText : t('badLink')}</Notice>;
}
