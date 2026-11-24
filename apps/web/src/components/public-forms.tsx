'use client';
import { ApiError, Feedback, Field, Loading, Notice, post, useAction, useApi, api } from '@vashundhara-foundation/ui';
import { toMinor } from '@vashundhara-foundation/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { Check, TextArea, TextField, values } from './forms';
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

interface OwnField { key: string; label: string; type: string; hint?: string; required?: boolean; min?: number; max?: number; choices?: { value: string; label: string }[] }
/** A form the NGO built for itself. */
export function OwnForm({ formKey, org }: { formKey: string; org: string }) {
  const t = useTranslations();
  const path = usePathname();
  const a = useAction();
  const { data, error } = useApi<{ title: string; intro: string | null; success: string | null; consent: boolean; fields: OwnField[] }>(`public/forms/${formKey}`);
  if (error) return error.status === 401 ? <><h1 className="mb-4 text-3xl font-bold">{t('nav.login')}</h1><Notice>{t('forms.signIn')}</Notice><Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(path)}`}>{t('nav.login')}</Link></> : <><h1 className="mb-4 text-3xl font-bold">{t('common.notFound')}</h1><Notice kind="error">{error.message}</Notice></>;
  if (!data) return <Loading label={t('common.loading')} />;
  const read = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const out: Record<string, unknown> = {};
    for (const f of data.fields) {
      const raw = String(fd.get(f.key) ?? '').trim();
      if (f.type === 'bool') out[f.key] = fd.get(f.key) === 'on';
      else if (f.type === 'multi') { const xs = fd.getAll(f.key); if (xs.length) out[f.key] = xs; }
      else if (raw === '') continue;
      else if (f.type === 'money') { const m = toMinor(raw); if (m === null) throw new ApiError(422, { code: 'VALIDATION', message: f.label, details: [{ path: f.key, message: t('common.error') }] }); out[f.key] = m; }
      else out[f.key] = f.type === 'number' ? Number(raw) : f.type === 'datetime' ? new Date(raw).toISOString() : raw;
    }
    return out;
  };
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">{data.title}</h1>
      {a.done ? <Notice kind="ok">{data.success ?? t('forms.thanks')}</Notice> : <>
        {data.intro && <p className="mb-6 whitespace-pre-wrap">{data.intro}</p>}
        <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; void a.run(() => post(`public/forms/${formKey}`, { values: read(form), website: String(new FormData(form).get('website') ?? ''), ...(data.consent ? { consent: new FormData(form).get('consent') === 'on' } : {}) }), 'ok'); }}>
          <Feedback action={a} />
          {data.fields.map((f) => {
            if (f.type === 'bool') return <Check key={f.key} name={f.key} label={f.label} hint={f.hint} />;
            if (f.type === 'multi') return <fieldset key={f.key} className="mb-4"><legend className="font-semibold">{f.label}</legend>{f.hint && <p className="field-hint">{f.hint}</p>}<div className="flex flex-wrap gap-3">{f.choices?.map((c) => <label key={c.value} className="flex items-center gap-2"><input type="checkbox" name={f.key} value={c.value} />{c.label}</label>)}</div></fieldset>;
            const type = ({ email: 'email', phone: 'tel', url: 'url', date: 'date', datetime: 'datetime-local', number: 'number' } as Record<string, string>)[f.type] ?? 'text';
            return <Field key={f.key} label={f.label} hint={f.hint} required={f.required} error={a.error?.field(f.key)}>{(p) => f.type === 'select' ? <select {...p} name={f.key} defaultValue=""><option value="">{t('forms.choose')}</option>{f.choices?.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : f.type === 'textarea' ? <textarea {...p} name={f.key} rows={5} /> : <input {...p} name={f.key} type={type} step="any" inputMode={f.type === 'money' ? 'decimal' : undefined} autoComplete={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : undefined} />}</Field>;
          })}
          {data.consent && <Check name="consent" label={t('forms.consent', { org })} required />}
          <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
          <button className="btn btn-primary" disabled={a.busy}>{t('forms.send')}</button>
        </form></>}
    </>
  );
}
