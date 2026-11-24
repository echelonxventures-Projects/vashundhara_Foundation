'use client';
import { ApiError, Feedback, Loading, Notice, post, useAction } from '@vashundhara-foundation/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Check, TextField, values } from './forms';
import { useSession } from './session';

const fragment = (k: string) => new URLSearchParams(window.location.hash.slice(1)).get(k) ?? '';
/** Only paths on this site are followed after signing in. */
const safeNext = (v: string | null) => (v && /^\/(?!\/)[\w\-/?=&]*$/.test(v) ? v : null);

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const { reload } = useSession();
  const a = useAction();
  const [challenge, setChallenge] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  useEffect(() => { const c = fragment('challenge'); if (c) { setChallenge(c); window.history.replaceState(null, '', window.location.pathname); } }, []);
  const finish = async () => {
    const m = await reload();
    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    router.push(next ?? (m?.permissions.length ? '/staff' : '/account'));
  };
  if (challenge) return (
    <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(async () => { await post('auth/login/mfa', { challenge, code: v.code }); await finish(); }); }}>
      <h2 className="mb-3 text-xl font-semibold">{t('auth.codeTitle')}</h2><Feedback action={a} />
      <TextField name="code" label={t('auth.code')} required autoComplete="one-time-code" autoFocus /><button className="btn btn-primary w-full" disabled={a.busy}>{t('auth.confirm')}</button>
    </form>
  );
  return (
    <>
      <form onSubmit={(e) => {
        e.preventDefault();
        const v = values(e.currentTarget);
        void a.run(async () => {
          try {
            const r = await post<{ mfaRequired?: boolean; challenge?: string }>('auth/login', { email: v.email, password: v.password, rememberMe: v.rememberMe === 'on' });
            if (r.mfaRequired) setChallenge(r.challenge!); else await finish();
          } catch (x) { setUnverified(x instanceof ApiError && x.code === 'EMAIL_UNVERIFIED'); throw x; }
        });
      }}>
        <Feedback action={a} />
        <TextField name="email" type="email" label={t('common.email')} required autoComplete="username" />
        <TextField name="password" type="password" label={t('common.password')} required autoComplete="current-password" />
        <Check name="rememberMe" label={t('auth.remember')} />
        <button className="btn btn-primary w-full" disabled={a.busy}>{t('auth.login')}</button>
      </form>
      {unverified && <div className="mt-4"><ResendForm /></div>}
      <p className="mt-4"><Link className="underline" href="/forgot-password">{t('auth.forgot')}</Link></p>
      <p className="mt-2">{t('auth.noAccount')} <Link className="underline" href="/register">{t('auth.register')}</Link></p>
      {process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === 'true' && <a className="btn btn-outline mt-4 w-full" href="/api/auth/google">{t('auth.google')}</a>}
    </>
  );
}
export function RegisterForm() {
  const t = useTranslations();
  const locale = useLocale();
  const a = useAction();
  const [role, setRole] = useState('donor');
  useEffect(() => { const r = new URLSearchParams(window.location.search).get('role'); if (r && ['donor', 'volunteer', 'beneficiary', 'student'].includes(r)) setRole(r); }, []);
  if (a.done) return <Notice kind="ok"><strong>{t('auth.checkEmail')}</strong><p>{t('auth.checkEmailText')}</p></Notice>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const { terms, ...v } = values(e.currentTarget); void a.run(() => post('auth/register', { ...v, role, locale, acceptTerms: terms === 'on' }), 'ok'); }}>
      <Feedback action={a} />
      <fieldset className="mb-4"><legend className="mb-2 font-semibold">{t('auth.iAm')}</legend><div className="flex flex-wrap gap-2">{([['donor', 'roleDonor'], ['volunteer', 'roleVolunteer'], ['beneficiary', 'roleBeneficiary'], ['student', 'roleStudent']] as const).map(([k, l]) => <label key={k} className={`btn ${role === k ? 'btn-primary' : 'btn-outline'}`}><input type="radio" className="sr-only" checked={role === k} onChange={() => setRole(k)} />{t(`auth.${l}`)}</label>)}</div></fieldset>
      <TextField name="firstName" label={t('common.firstName')} required autoComplete="given-name" /><TextField name="lastName" label={t('common.lastName')} required autoComplete="family-name" />
      <TextField name="email" type="email" label={t('common.email')} required autoComplete="email" />
      <TextField name="password" type="password" label={t('common.password')} hint={t('auth.passwordHint')} required minLength={10} autoComplete="new-password" error={a.error?.field('password')} />
      <Check name="terms" label={t('auth.accept')} required /><button className="btn btn-primary w-full" disabled={a.busy}>{t('auth.register')}</button>
      <p className="mt-4">{t('auth.haveAccount')} <Link className="underline" href="/login">{t('auth.login')}</Link></p>
    </form>
  );
}
export function NgoForm() {
  const t = useTranslations();
  const a = useAction();
  const [url, setUrl] = useState('');
  if (url) return <Notice kind="ok">{t('auth.ngoDone', { url })}</Notice>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const { terms, ...v } = values(e.currentTarget); void a.run(async () => setUrl((await post<{ url: string }>('auth/register-ngo', { ...v, acceptTerms: terms === 'on' })).url)); }}>
      <p className="mb-4 text-muted">{t('auth.ngoText')}</p><Feedback action={a} />
      <TextField name="ngoName" label={t('auth.ngoName')} required minLength={3} /><TextField name="slug" label={t('auth.ngoSlug')} hint={t('auth.ngoSlugHint')} required pattern="[a-z0-9][a-z0-9\-]{1,40}[a-z0-9]" />
      <TextField name="firstName" label={t('common.firstName')} required autoComplete="given-name" /><TextField name="lastName" label={t('common.lastName')} required autoComplete="family-name" />
      <TextField name="email" type="email" label={t('common.email')} required autoComplete="email" /><TextField name="password" type="password" label={t('common.password')} hint={t('auth.passwordHint')} required minLength={10} autoComplete="new-password" />
      <Check name="terms" label={t('auth.accept')} required /><button className="btn btn-primary w-full" disabled={a.busy}>{t('auth.ngoCreate')}</button>
    </form>
  );
}
function EmailOnly({ path, label }: { path: string; label: string }) {
  const t = useTranslations();
  const a = useAction();
  return <form onSubmit={(e) => { e.preventDefault(); void a.run(() => post(path, values(e.currentTarget)), t('auth.checkEmailText')); }}><TextField name="email" type="email" label={t('common.email')} required autoComplete="email" /><Feedback action={a} /><button className="btn btn-outline" disabled={a.busy}>{label}</button></form>;
}
export const ForgotForm = () => { const t = useTranslations('auth'); return <EmailOnly path="auth/password/forgot" label={t('sendLink')} />; };
export const ResendForm = () => { const t = useTranslations('auth'); return <EmailOnly path="auth/verify-email/resend" label={t('resend')} />; };
export function ResetForm() {
  const t = useTranslations();
  const a = useAction();
  const [token, setToken] = useState('');
  useEffect(() => { setToken(fragment('token')); window.history.replaceState(null, '', window.location.pathname); }, []);
  if (a.done) return <><Notice kind="ok">{a.done}</Notice><Link className="btn btn-primary" href="/login">{t('auth.login')}</Link></>;
  return <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(() => post('auth/password/reset', { token, password: v.password }), t('auth.resetDone')); }}><Feedback action={a} /><TextField name="password" type="password" label={t('auth.newPassword')} hint={t('auth.passwordHint')} required minLength={10} autoComplete="new-password" /><button className="btn btn-primary" disabled={a.busy}>{t('auth.reset')}</button></form>;
}
export function InviteForm() {
  const t = useTranslations();
  const router = useRouter();
  const { me, reload } = useSession();
  const a = useAction();
  const [token, setToken] = useState('');
  const [info, setInfo] = useState<{ email: string; organisation: string; hasAccount: boolean } | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => { const k = fragment('token'); setToken(k); post('auth/invitation/preview', { token: k }).then(setInfo).catch(() => setBad(true)); }, []);
  if (bad) return <Notice kind="error">{t('auth.badLink')}</Notice>;
  if (!info) return <Loading label={t('common.loading')} />;
  const signedIn = me?.user?.email.toLowerCase() === info.email.toLowerCase();
  if (info.hasAccount && !signedIn) return <><p className="mb-4">{t('auth.invite', { org: info.organisation })}</p><Notice>{t('auth.signInFirst', { email: info.email })}</Notice><Link className="btn btn-primary" href="/login">{t('auth.login')}</Link></>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(async () => { await post('auth/invitation/accept', { token, ...v }); await reload(); router.push(signedIn ? '/staff' : '/login'); }); }}>
      <p className="mb-4">{t('auth.invite', { org: info.organisation })}</p><Feedback action={a} />
      {!info.hasAccount && <><TextField name="firstName" label={t('common.firstName')} required /><TextField name="lastName" label={t('common.lastName')} required /><TextField name="password" type="password" label={t('common.password')} hint={t('auth.passwordHint')} required minLength={10} autoComplete="new-password" /></>}
      <button className="btn btn-primary w-full" disabled={a.busy}>{t('auth.acceptInvite')}</button>
    </form>
  );
}
