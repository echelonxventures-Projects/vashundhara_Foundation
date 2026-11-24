'use client';
import { formatMinor, PAN_REGEX, toMinor } from '@vashundhara-foundation/shared';
import { api, Feedback, Notice, post, useAction } from '@vashundhara-foundation/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Check, TextArea, TextField, values } from './forms';
import { useSession } from './session';

type Started = { provider: 'RAZORPAY' | 'MOCK'; keyId: string; amountMinor: number; name: string } & ({ kind: 'order'; donationId: string; token: string; orderId: string } | { kind: 'subscription'; subscriptionId: string; providerSubscriptionId: string });
type Paid = { paymentId: string; signature: string };
declare global { interface Window { Razorpay?: new (o: unknown) => { open: () => void; on: (e: string, f: () => void) => void } } }

async function loadCheckout() {
  if (window.Razorpay) return;
  await new Promise<void>((ok, no) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => ok(); s.onerror = () => no(new Error('checkout')); document.head.append(s); });
}
async function collect(s: Started, donor: { fullName: string; email: string; phone?: string }): Promise<Paid | null> {
  if (s.provider === 'MOCK') return post<Paid>('dev/mock-pay', s.kind === 'order' ? { orderId: s.orderId, amountMinor: s.amountMinor } : { subscriptionId: s.providerSubscriptionId, amountMinor: s.amountMinor });
  await loadCheckout();
  return new Promise((resolve) => {
    const r = new window.Razorpay!({
      key: s.keyId, name: s.name, ...(s.kind === 'order' ? { order_id: s.orderId, amount: s.amountMinor, currency: 'INR' } : { subscription_id: s.providerSubscriptionId }),
      prefill: { name: donor.fullName, email: donor.email, contact: donor.phone }, handler: (x: { razorpay_payment_id: string; razorpay_signature: string }) => resolve({ paymentId: x.razorpay_payment_id, signature: x.razorpay_signature }),
      modal: { ondismiss: () => resolve(null) }
    });
    r.open();
  });
}

export function DonateForm({ campaignSlug, suggested, has80G, acceptsForeign, is80GEligible = true }: { campaignSlug?: string; suggested: number[]; has80G: boolean; acceptsForeign: boolean; is80GEligible?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const { me } = useSession();
  const a = useAction();
  const money = (m: number) => formatMinor(m, 'INR', locale);
  const options = suggested.length ? suggested : [50_000, 100_000, 250_000, 500_000];
  const [amount, setAmount] = useState(String(options[1] / 100));
  const [interval, setInterval] = useState('');
  const [citizen, setCitizen] = useState(true);
  const [tax, setTax] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ kind: 'done' | 'pending' | 'failed' | 'recurring'; amountMinor: number; receipt?: string | null } | null>(null);
  const [prefill, setPrefill] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => { if (me?.user) setPrefill({ name: `${me.user.firstName} ${me.user.lastName}`.trim(), email: me.user.email }); }, [me]);
  const minor = toMinor(amount);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = values(e.currentTarget);
    const errs: Record<string, string> = {};
    const pan = v.pan?.toUpperCase();
    if (!minor || minor < 100) errs.amount = t('donate.invalidAmount');
    if (tax && !PAN_REGEX.test(pan ?? '')) errs.pan = t('donate.invalidPan');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await a.run(async () => {
      const donor = { fullName: v.fullName, email: v.email, phone: v.phone, isIndianCitizen: citizen, marketingConsent: v.updates === 'on', ...(tax ? { pan, address: v.address ? { line: v.address } : undefined } : {}) };
      const s = await post<Started>('public/donations', { amountMinor: minor, campaignSlug, donor, isAnonymous: v.anonymous === 'on', wants80G: tax, message: v.message, interval: interval || undefined });
      const paid = await collect(s, donor);
      if (!paid) return;
      if (s.kind === 'subscription') { await post(`public/subscriptions/${s.subscriptionId}/confirm`, paid); setState({ kind: 'recurring', amountMinor: s.amountMinor }); return; }
      setState({ kind: 'pending', amountMinor: s.amountMinor });
      let st = await post<{ status: string; receiptNumber: string | null }>(`public/donations/${s.donationId}/confirm`, { token: s.token, ...paid }).catch(() => null);
      for (let i = 0; i < 20 && st?.status !== 'COMPLETED' && st?.status !== 'FAILED'; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        st = await api<{ status: string; receiptNumber: string | null }>(`public/donations/${s.donationId}?token=${s.token}`).catch(() => null);
      }
      if (st?.status === 'COMPLETED') setState({ kind: 'done', amountMinor: s.amountMinor, receipt: st.receiptNumber });
      else if (st?.status === 'FAILED') setState({ kind: 'failed', amountMinor: s.amountMinor });
    });
  };

  if (state) return (
    <div className="card" role="status" tabIndex={-1}>
      {state.kind === 'done' && <><h2 className="text-2xl font-bold">{t('donate.thanks')}</h2><p>{t('donate.thanksText', { amount: money(state.amountMinor), receipt: state.receipt ?? '' })}</p></>}
      {state.kind === 'recurring' && <><h2 className="text-2xl font-bold">{t('donate.thanks')}</h2><p>{t('donate.thanksRecurring')}</p></>}
      {state.kind === 'pending' && <p>{t('donate.pending')}</p>}
      {state.kind === 'failed' && <><Notice kind="error">{t('donate.failed')}</Notice><button className="btn btn-primary" onClick={() => setState(null)}>{t('common.tryAgain')}</button></>}
    </div>
  );
  return (
    <form onSubmit={submit} noValidate={false}>
      <fieldset className="mb-4"><legend className="mb-2 font-semibold">{t('donate.howOften')}</legend><div className="flex flex-wrap gap-2">
        {([['', 'once'], ['MONTHLY', 'monthly'], ['QUARTERLY', 'quarterly'], ['YEARLY', 'yearly']] as const).map(([k, l]) => <label key={k} className={`btn ${interval === k ? 'btn-primary' : 'btn-outline'}`}><input className="sr-only" type="radio" name="interval" checked={interval === k} onChange={() => setInterval(k)} />{t(`donate.${l}`)}</label>)}
      </div></fieldset>
      <fieldset className="mb-2"><legend className="mb-2 font-semibold">{t('donate.amount')}</legend><div className="flex flex-wrap gap-2">
        {options.map((o) => <label key={o} className={`btn ${minor === o ? 'btn-primary' : 'btn-outline'}`}><input className="sr-only" type="radio" name="preset" checked={minor === o} onChange={() => setAmount(String(o / 100))} />{money(o)}</label>)}
      </div></fieldset>
      <TextField name="amount" label={t('donate.other')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} required />
      <h2 className="mb-3 mt-6 text-xl font-semibold">{t('donate.details')}</h2>
      <TextField key={`n${prefill?.name}`} name="fullName" label={t('common.name')} defaultValue={prefill?.name} required autoComplete="name" minLength={2} maxLength={120} />
      <TextField key={`e${prefill?.email}`} name="email" type="email" label={t('common.email')} defaultValue={prefill?.email} required autoComplete="email" />
      <TextField name="phone" type="tel" label={`${t('common.phone')} (${t('common.optional')})`} autoComplete="tel" pattern="\+?[0-9 \-]{7,16}" />
      <Check label={t('donate.citizen')} hint={t('donate.citizenNote')} checked={citizen} onChange={(e) => { setCitizen(e.target.checked); if (!e.target.checked) setTax(false); }} />
      {!citizen && !acceptsForeign && <Notice kind="error">{t('donate.foreignNo')}</Notice>}
      {has80G && is80GEligible && citizen && <Check label={t('donate.want80g')} checked={tax} onChange={(e) => setTax(e.target.checked)} />}
      {tax && <><TextField name="pan" label={t('donate.pan')} hint={t('donate.panHint')} error={errors.pan} required maxLength={10} autoCapitalize="characters" autoComplete="off" /><TextArea name="address" label={t('donate.addressFor80g')} required maxLength={200} rows={2} autoComplete="street-address" /></>}
      <Check name="anonymous" label={t('donate.anonymous')} /><Check name="updates" label={t('donate.updates')} />
      <TextArea name="message" label={`${t('donate.note')} (${t('common.optional')})`} maxLength={500} rows={2} />
      <Feedback action={a} />
      <button className="btn btn-primary w-full text-lg" disabled={a.busy || (!citizen && !acceptsForeign)}>{a.busy ? t('common.loading') : t(interval ? 'donate.start' : 'donate.pay', { amount: money(minor ?? 0) })}</button>
      <p className="mt-3 text-sm text-muted">{t('donate.secure')} {t('donate.agree')} <Link className="underline" href="/terms">{t('nav.terms')}</Link>, <Link className="underline" href="/refunds">{t('nav.refunds')}</Link></p>
    </form>
  );
}
