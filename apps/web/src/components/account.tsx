'use client';
import { formatMinor } from '@vashundhara-foundation/shared';
import { api, Badge, del, Empty, Feedback, Loading, Notice, Pager, post, put, saveText, uploadFile, useAction, useApi } from '@vashundhara-foundation/ui';
import { useLocale, useTranslations } from 'next-intl';
import { ReactNode, useEffect, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { Check, TextArea, TextField, values } from './forms';
import { useSession } from './session';

export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { me, loading } = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (!loading && !me?.user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [loading, me, path, router]);
  if (loading || !me?.user) return <Loading label={t('common.loading')} />;
  const tabs: [string, string][] = [['/account/giving', 'giving'], ['/account/volunteering', 'volunteering'], ['/account/support', 'support'], ['/account/learning', 'learning'], ...(me.roles.includes('csr_partner') ? ([['/account/csr', 'csr']] as [string, string][]) : []), ['/account/notifications', 'notifications'], ['/account/profile', 'profile'], ['/account/security', 'security'], ['/account/privacy', 'privacy']];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t('account.title')}</h1>
      <nav aria-label={t('account.title')} className="my-5 flex flex-wrap gap-2">{tabs.map(([h, k]) => <Link key={h} href={h} aria-current={path.startsWith(h) ? 'page' : undefined} className={`btn btn-sm ${path.startsWith(h) ? 'btn-primary' : 'btn-outline'}`}>{t(`account.${k}`)}</Link>)}</nav>
      {children}
      {me.memberships.length > 1 && <p className="mt-8 text-muted">{t('account.switch')}: {me.memberships.filter((m) => m.slug !== me.tenant?.slug).map((m) => <a key={m.slug} className="me-3 underline" href={m.url}>{m.name}</a>)}</p>}
    </div>
  );
}
const useFmt = () => { const l = useLocale(); return { money: (m: number) => formatMinor(m, 'INR', l), date: (d: string) => new Date(d).toLocaleDateString(l, { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }), time: (d: string) => new Date(d).toLocaleString(l, { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) }; };
const H2 = ({ children }: { children: ReactNode }) => <h2 className="mb-3 mt-6 text-xl font-semibold">{children}</h2>;

export function Giving() {
  const t = useTranslations();
  const f = useFmt();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useApi(`me/giving?page=${page}`);
  const a = useAction();
  if (loading && !data) return <Loading label={t('common.loading')} />;
  if (!data) return null;
  return (
    <>
      <p className="text-lg">{t('account.total', { amount: f.money(data.totalMinor) })}</p><Feedback action={a} />
      {data.subscriptions.length > 0 && <><H2>{t('account.recurring')}</H2><ul className="grid gap-3">{data.subscriptions.map((s: any) => <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3"><span>{f.money(s.amountMinor)} · {t(`donate.${({ MONTHLY: 'monthly', QUARTERLY: 'quarterly', YEARLY: 'yearly' } as const)[s.interval as 'MONTHLY']}`)} {s.campaign?.title} <Badge value={s.status} /></span><button className="btn btn-danger btn-sm" disabled={a.busy} onClick={() => window.confirm(t('account.stopConfirm')) && a.run(async () => { await put(`me/giving/subscriptions/${s.id}/cancel`); await reload(); })}>{t('account.stop')}</button></li>)}</ul></>}
      <H2>{t('account.giving')}</H2>
      {!data.items.length ? <Empty>{t('common.none')}</Empty> : <ul className="grid gap-3">{data.items.map((d: any) => <li key={d.id} className="card flex flex-wrap items-center justify-between gap-3"><span><strong>{f.money(d.amountMinor)}</strong> · {f.date(d.completedAt ?? d.createdAt)} {d.campaign && `· ${d.campaign.title}`} <Badge value={d.status} /></span>{d.receipts[0] && <a className="btn btn-outline btn-sm" href={`/api/receipts/mine/${d.receipts[0].id}`}>{t('account.receipts')} {d.receipts[0].number}</a>}</li>)}</ul>}
      <Pager {...data} onPage={setPage} />
    </>
  );
}

function NeedRole({ role, label, children }: { role: string; label: string; children: ReactNode }) {
  const { me, reload } = useSession();
  const a = useAction();
  const t = useTranslations();
  if (me?.roles.includes(role)) return <>{children}</>;
  return <div className="card"><p className="mb-3">{label}</p><Feedback action={a} /><button className="btn btn-primary" disabled={a.busy} onClick={() => a.run(async () => { await post('auth/roles', { role }); await reload(); })}>{t('account.addRole')}</button></div>;
}
export function Volunteering() {
  const t = useTranslations();
  return <NeedRole role="volunteer" label={t('volunteer.intro')}><VolunteerHome /></NeedRole>;
}
function VolunteerHome() {
  const t = useTranslations();
  const f = useFmt();
  const { me } = useSession();
  const mine = useApi('volunteering/me');
  const shifts = useApi('volunteering/shifts?limit=50');
  const a = useAction();
  if (mine.loading && !mine.data) return <Loading label={t('common.loading')} />;
  const v = mine.data?.profile;
  const reload = async () => { await Promise.all([mine.reload(), shifts.reload()]); };
  const status = new Map<string, string>((v?.shiftAssignments ?? []).map((x: any) => [x.shiftId, x.status]));
  return (
    <>
      <Feedback action={a} />
      {v?.status === 'PENDING' && <Notice>{t('volunteer.pending')}</Notice>}
      {v?.status === 'ACTIVE' && <><H2>{t('volunteer.shifts')}</H2>{!shifts.data?.items.length ? <Empty>{t('common.none')}</Empty> : <ul className="grid gap-3">{shifts.data.items.map((s: any) => { const st = status.get(s.id); const inIt = st && st !== 'CANCELLED'; return <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3"><span><strong>{s.title}</strong><br />{f.time(s.startDateTime)} {s.location && `· ${s.location}`} · {s._count.assignments}/{s.maxVolunteers}</span>{inIt ? <span className="flex gap-2"><span className="badge badge-ok">{st === 'WAITLISTED' ? t('volunteer.waitlisted') : t('volunteer.joined')}</span><button className="btn btn-outline btn-sm" disabled={a.busy} onClick={() => a.run(async () => { await post(`volunteering/shifts/${s.id}/leave`); await reload(); })}>{t('volunteer.leave')}</button></span> : <button className="btn btn-primary btn-sm" disabled={a.busy} onClick={() => a.run(async () => { await post(`volunteering/shifts/${s.id}/join`); await reload(); })}>{t('volunteer.join')}</button>}</li>; })}</ul>}
        <H2>{t('volunteer.hours')}: {Number(v.totalHours)}</H2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const x = values(form); void a.run(async () => { await post('volunteering/me/hours', { date: x.date, hours: Number(x.hours), description: x.description }); form.reset(); await mine.reload(); }, t('common.saved')); }}>
          <TextField name="date" type="date" label={t('common.date')} required /><TextField name="hours" type="number" step="0.25" min="0.25" max="24" label={t('volunteer.hoursCount')} required /><TextField name="description" label={t('common.message')} /><button className="btn btn-outline mb-4" disabled={a.busy}>{t('volunteer.logHours')}</button>
        </form>
        <ul>{v.hoursLogs.map((h: any) => <li key={h.id}>{f.date(h.date)}: {Number(h.hours)} <Badge value={h.status} /> {h.description}</li>)}</ul>
        {v.certificates.length > 0 && <><H2>{t('volunteer.certificates')}</H2><ul>{v.certificates.map((c: any) => <li key={c.id}><a className="underline" href={`/api/volunteering/certificates/${c.code}/pdf`}>{c.title}</a></li>)}</ul></>}</>}
      <H2>{t('volunteer.profile')}</H2>
      <form className="max-w-lg" onSubmit={(e) => { e.preventDefault(); const x = values(e.currentTarget); void a.run(async () => { await put('volunteering/me', { firstName: x.firstName, lastName: x.lastName, phone: x.phone, occupation: x.occupation, skills: (x.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean) }); await reload(); }, t('common.saved')); }}>
        <TextField name="firstName" label={t('common.firstName')} defaultValue={v?.firstName ?? me?.user?.firstName} required /><TextField name="lastName" label={t('common.lastName')} defaultValue={v?.lastName ?? me?.user?.lastName} required /><TextField name="phone" type="tel" label={t('common.phone')} defaultValue={v?.phone ?? ''} /><TextField name="skills" label={t('volunteer.skills')} defaultValue={v?.skills?.join(', ') ?? ''} /><button className="btn btn-primary" disabled={a.busy}>{t('common.save')}</button>
      </form>
    </>
  );
}
export function Support() {
  const t = useTranslations();
  const f = useFmt();
  const { me } = useSession();
  const { data, reload } = useApi('beneficiary-services/me');
  const a = useAction();
  return (
    <NeedRole role="beneficiary" label={t('support.intro')}>
      {data?.items.length > 0 && <><H2>{t('support.mine')}</H2>{data.items.map((b: any) => <div key={b.id} className="card mb-3"><p><strong>{b.fullName}</strong> <Badge value={b.status} /> {f.date(b.createdAt)}</p><p>{b.need}</p>{b.cases.length > 0 && <><h3 className="mt-3 font-semibold">{t('support.cases')}</h3><ul>{b.cases.map((c: any) => <li key={c.id}>{c.title} <Badge value={c.status} /></li>)}</ul></>}{b.aidRecords.length > 0 && <><h3 className="mt-3 font-semibold">{t('support.aid')}</h3><ul>{b.aidRecords.map((x: any) => <li key={x.id}>{f.date(x.givenAt)}: {x.description}</li>)}</ul></>}</div>)}</>}
      <H2>{t('support.title')}</H2>
      <form className="max-w-lg" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const { consent, address, ...x } = values(form); void a.run(async () => { await post('beneficiary-services/apply', { ...x, address: address ? { line: address } : undefined, consent: consent === 'on' }); form.reset(); await reload(); }, t('support.sent')); }}>
        <Feedback action={a} /><TextField name="fullName" label={t('common.name')} defaultValue={me?.user ? `${me.user.firstName} ${me.user.lastName}` : ''} required /><TextField name="phone" type="tel" label={t('common.phone')} /><TextField name="dateOfBirth" type="date" label={t('learn.dob')} /><TextArea name="address" label={t('common.address')} rows={2} maxLength={200} /><TextArea name="need" label={t('support.need')} required maxLength={3000} /><Check name="consent" label={t('support.consent')} required /><button className="btn btn-primary" disabled={a.busy}>{t('support.apply')}</button>
      </form>
    </NeedRole>
  );
}
export function Learning() {
  const t = useTranslations();
  const { me } = useSession();
  const { data, reload } = useApi('learning/me');
  const courses = useApi('learning/courses?limit=100');
  const a = useAction();
  const s = data?.student;
  const joined = new Set((data?.enrolments ?? []).map((e: any) => e.course.id));
  return (
    <NeedRole role="student" label={t('learn.apply')}>
      <Feedback action={a} />
      {s?.status === 'APPLIED' && <Notice>{t('learn.waiting')}</Notice>}
      {data?.enrolments.length > 0 && <><H2>{t('learn.myCourses')}</H2><ul className="grid gap-3">{data.enrolments.map((e: any) => <li key={e.id} className="card"><Link className="text-lg font-semibold underline" href={`/account/learning/${e.course.id}`}>{e.course.title}</Link><p>{t('learn.progress', { done: e.done, total: e.lessons })} <Badge value={e.status} /></p></li>)}</ul></>}
      {s?.status === 'ACTIVE' && <><H2>{t('learn.title')}</H2><ul className="grid gap-3">{courses.data?.items.filter((c: any) => !joined.has(c.id)).map((c: any) => <li key={c.id} className="card flex items-center justify-between gap-3"><span><strong>{c.title}</strong><br />{c.summary}</span><button className="btn btn-primary btn-sm" disabled={a.busy} onClick={() => a.run(async () => { await post(`learning/courses/${c.id}/enrol`); await reload(); })}>{t('learn.enrol')}</button></li>)}</ul></>}
      <H2>{t('learn.profile')}</H2>
      <form key={s?.id ?? 'new'} className="max-w-lg" onSubmit={(e) => { e.preventDefault(); const { guardianConsent, ...x } = values(e.currentTarget); void a.run(async () => { await put('learning/me', { ...x, guardianConsent: guardianConsent === 'on' }); await reload(); }, t('common.saved')); }}>
        <TextField name="fullName" label={t('common.name')} defaultValue={s?.fullName ?? (me?.user ? `${me.user.firstName} ${me.user.lastName}` : '')} required /><TextField name="dateOfBirth" type="date" label={t('learn.dob')} defaultValue={s?.dateOfBirth?.slice(0, 10)} required /><TextField name="grade" label={t('learn.grade')} defaultValue={s?.grade ?? ''} /><TextField name="school" label={t('learn.school')} defaultValue={s?.school ?? ''} /><TextField name="guardianName" label={t('learn.guardian')} defaultValue={s?.guardianName ?? ''} /><TextField name="guardianPhone" type="tel" label={t('learn.guardianPhone')} defaultValue={s?.guardianPhone ?? ''} /><Check name="guardianConsent" label={t('learn.guardianConsent')} defaultChecked={Boolean(s?.guardianConsentAt)} /><button className="btn btn-primary" disabled={a.busy}>{t('common.save')}</button>
      </form>
    </NeedRole>
  );
}
export function CourseView({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFmt();
  const { data, error, reload } = useApi(`learning/courses/${id}`);
  const a = useAction();
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!data) return <Loading label={t('common.loading')} />;
  return (
    <>
      <h2 className="text-2xl font-bold">{data.course.title}</h2><Feedback action={a} />
      <H2>{t('learn.lessons', { count: data.lessons.length })}</H2>
      {data.lessons.map((l: any) => <details key={l.id} className="card mb-3"><summary className="cursor-pointer font-semibold">{l.title} {l.done && <span className="badge badge-ok">{t('learn.done')}</span>}</summary><div className="mt-3 whitespace-pre-wrap">{l.body}</div>{l.videoUrl && <p><a className="underline" href={l.videoUrl} rel="noopener" target="_blank">{t('common.open')}</a></p>}{!l.done && <button className="btn btn-outline btn-sm mt-3" disabled={a.busy} onClick={() => a.run(async () => { await post(`learning/lessons/${l.id}/complete`); await reload(); })}>{t('learn.markDone')}</button>}</details>)}
      {data.classes.length > 0 && <><H2>{t('learn.classes')}</H2><ul className="grid gap-3">{data.classes.map((c: any) => <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3"><span><strong>{c.title}</strong><br />{f.time(c.startsAt)}</span>{c.joinable ? <button className="btn btn-primary btn-sm" onClick={() => a.run(async () => { window.location.assign((await post<{ url: string }>(`learning/classes/${c.id}/join`)).url); })}>{t('learn.joinClass')}</button> : c.recordingUrl ? <a className="underline" href={c.recordingUrl} rel="noopener">{t('learn.recording')}</a> : <span className="text-muted">{t('learn.opens')}</span>}</li>)}</ul></>}
      {data.assignments.length > 0 && <><H2>{t('learn.assignments')}</H2>{data.assignments.map((x: any) => <div key={x.id} className="card mb-3"><h3 className="font-semibold">{x.title}</h3>{x.dueAt && <p className="text-muted">{t('learn.due', { date: f.time(x.dueAt) })}</p>}<p className="whitespace-pre-wrap">{x.instructions}</p>
        {x.submission && <p className="mt-2"><Badge value={x.submission.status} /> {x.submission.isLate && <span className="badge badge-bad">{t('learn.late')}</span>} {x.submission.score !== null && t('learn.marks', { score: x.submission.score, max: x.maxScore })} {x.submission.feedback}</p>}
        {x.submission?.status !== 'GRADED' && <form className="mt-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0]; const text = values(form).text; void a.run(async () => { const fileId = file ? await uploadFile(file) : undefined; await post(`learning/assignments/${x.id}/submit`, { text, fileId }); await reload(); }, t('learn.submitted')); }}><TextArea name="text" label={t('learn.answer')} defaultValue={x.submission?.text ?? ''} /><TextField name="file" type="file" label={t('learn.attach')} accept=".pdf,.jpg,.jpeg,.png,.docx" /><button className="btn btn-primary btn-sm" disabled={a.busy}>{t('learn.submit')}</button></form>}</div>)}</>}
    </>
  );
}
export function Csr() {
  const t = useTranslations();
  const f = useFmt();
  const { data, error } = useApi('csr/portal');
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!data) return <Loading label={t('common.loading')} />;
  return <><h2 className="text-2xl font-bold">{data.organization?.name}</h2><H2>{t('account.grants')}</H2>{data.grants.map((g: any) => <div key={g.id} className="card mb-3"><h3 className="text-lg font-semibold">{g.title} <Badge value={g.status} /></h3><p>{t('account.spent', { spent: f.money(g.spentMinor), total: f.money(g.amountMinor) })}</p><div className="bar my-2"><span style={{ width: `${Math.min(100, (g.spentMinor / g.amountMinor) * 100)}%` }} /></div><ul>{g.utilisations.map((u: any) => <li key={u.id}>{f.date(u.spentAt)} · {u.category}: {f.money(u.amountMinor)} · {u.description}</li>)}</ul></div>)}<ul>{data.invoices.map((i: any) => <li key={i.id}>{i.number}: {f.money(i.amountMinor)} <Badge value={i.status} /></li>)}</ul></>;
}
export function Profile() {
  const t = useTranslations();
  const { reload } = useSession();
  const { data } = useApi('auth/profile');
  const a = useAction();
  if (!data) return <Loading label={t('common.loading')} />;
  return <form className="max-w-lg" onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(async () => { await put('auth/profile', { firstName: v.firstName, lastName: v.lastName, phone: v.phone ?? null }); await reload(); }, t('common.saved')); }}><Feedback action={a} /><p className="mb-4 text-muted">{data.email}</p><TextField name="firstName" label={t('common.firstName')} defaultValue={data.firstName} required /><TextField name="lastName" label={t('common.lastName')} defaultValue={data.lastName} required /><TextField name="phone" type="tel" label={t('common.phone')} defaultValue={data.phone ?? ''} /><button className="btn btn-primary" disabled={a.busy}>{t('common.save')}</button></form>;
}
export function Security() {
  const t = useTranslations();
  const f = useFmt();
  const { data, reload } = useApi('auth/profile');
  const sessions = useApi('auth/sessions');
  const pw = useAction();
  const mfa = useAction();
  const [setup, setSetup] = useState<{ secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  return (
    <div className="grid max-w-xl gap-8">
      <section><H2>{t('account.changePassword')}</H2><form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; void pw.run(async () => { await post('auth/password/change', values(form)); form.reset(); await sessions.reload(); }, t('account.passwordChanged')); }}><Feedback action={pw} /><TextField name="current" type="password" label={t('account.currentPassword')} required autoComplete="current-password" /><TextField name="next" type="password" label={t('auth.newPassword')} hint={t('auth.passwordHint')} required minLength={10} autoComplete="new-password" /><button className="btn btn-primary" disabled={pw.busy}>{t('account.changePassword')}</button></form></section>
      <section><H2>{t('account.twoStep')}</H2><Feedback action={mfa} />
        {codes && <Notice kind="ok"><p>{t('account.backup')}</p><p className="mt-2 font-mono">{codes.join('  ')}</p></Notice>}
        {data?.mfaEnabled ? <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void mfa.run(async () => { await post('auth/mfa/disable', v); setCodes(null); await reload(); }); }}><p className="mb-3">{t('account.twoStepOn')}</p><TextField name="password" type="password" label={t('common.password')} required autoComplete="current-password" /><TextField name="code" label={t('auth.code')} required autoComplete="one-time-code" /><button className="btn btn-danger" disabled={mfa.busy}>{t('account.turnOff')}</button></form>
          : setup ? <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void mfa.run(async () => { setCodes((await post<{ backupCodes: string[] }>('auth/mfa/enable', v)).backupCodes); setSetup(null); await reload(); }); }}><p>{t('account.secret')}</p><p className="my-3 break-all font-mono text-lg">{setup.secret.match(/.{1,4}/g)?.join(' ')}</p><TextField name="code" label={t('auth.code')} required inputMode="numeric" autoComplete="one-time-code" /><button className="btn btn-primary" disabled={mfa.busy}>{t('auth.confirm')}</button></form>
          : <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void mfa.run(async () => setSetup(await post('auth/mfa/setup', v))); }}><p className="mb-3">{t('account.twoStepOff')}</p><TextField name="password" type="password" label={t('common.password')} required autoComplete="current-password" /><button className="btn btn-primary" disabled={mfa.busy}>{t('account.turnOn')}</button></form>}
      </section>
      <section><H2>{t('account.sessions')}</H2><ul className="grid gap-2">{sessions.data?.map((s: any) => <li key={s.id} className="card flex items-center justify-between gap-3"><span className="min-w-0"><span className="block truncate">{s.userAgent ?? '-'}</span><span className="text-sm text-muted">{s.ipAddress} · {f.time(s.updatedAt)}</span></span>{s.current ? <span className="badge badge-ok">{t('account.thisDevice')}</span> : <button className="btn btn-outline btn-sm" onClick={async () => { await del(`auth/sessions/${s.id}`); await sessions.reload(); }}>{t('account.end')}</button>}</li>)}</ul></section>
    </div>
  );
}
export function PrivacyPanel() {
  const t = useTranslations();
  const a = useAction();
  return (
    <div className="grid max-w-xl gap-8"><Feedback action={a} />
      <section><button className="btn btn-outline" disabled={a.busy} onClick={() => a.run(async () => saveText('my-data.json', JSON.stringify(await api('privacy/export'), null, 2), 'application/json'))}>{t('account.export')}</button></section>
      <section><p className="mb-2">{t('account.marketing')}</p><div className="flex gap-2"><button className="btn btn-outline" onClick={() => a.run(() => put('privacy/consents', { purpose: 'marketing', granted: true }), t('common.saved'))}>{t('common.yes')}</button><button className="btn btn-outline" onClick={() => a.run(() => put('privacy/consents', { purpose: 'marketing', granted: false }), t('common.saved'))}>{t('common.no')}</button></div></section>
      <section><H2>{t('account.erase')}</H2><p className="mb-3">{t('account.eraseText')}</p><form onSubmit={(e) => { e.preventDefault(); void a.run(() => post('privacy/requests', { type: 'ERASURE', ...values(e.currentTarget) }), t('account.requested')); }}><TextField name="password" type="password" label={t('account.currentPassword')} autoComplete="current-password" /><button className="btn btn-danger" disabled={a.busy}>{t('account.erase')}</button></form></section>
    </div>
  );
}
export function Messages() {
  const t = useTranslations();
  const f = useFmt();
  const { data, reload } = useApi('me/notifications?limit=50');
  const a = useAction();
  useEffect(() => { if (data?.unread) void post('me/notifications/read').then(reload); }, [data?.unread, reload]);
  const push = () => a.run(async () => {
    const { key } = await api<{ key: string | null }>('me/notifications/push-key');
    if (!key || !('serviceWorker' in navigator) || (await Notification.requestPermission()) !== 'granted') throw new Error('unavailable');
    const reg = await navigator.serviceWorker.register('/sw.js');
    const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
    const j = sub.toJSON();
    await put('me/notifications/push', { endpoint: j.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
  }, t('account.pushOn'));
  return <><Feedback action={a} /><button className="btn btn-outline mb-4" onClick={push} disabled={a.busy}>{t('account.enablePush')}</button>{data && !data.items.length && <Empty>{t('common.none')}</Empty>}<ul className="grid gap-3">{data?.items.map((n: any) => <li key={n.id} className="card"><p className="font-semibold">{n.subject}</p><p className="whitespace-pre-wrap">{n.content}</p><p className="text-sm text-muted">{f.time(n.createdAt)}</p></li>)}</ul></>;
}
