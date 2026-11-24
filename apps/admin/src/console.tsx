'use client';
import { api, Badge, Dialog, Empty, Feedback, Field, Loading, Notice, Pager, post, put, refreshSession, Table, useAction, useApi } from '@vashundhara-foundation/ui';
import { formatMinor } from '@vashundhara-foundation/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

type User = { email: string; isSystemAdmin: boolean; mfaEnabled: boolean } | null;
const C = createContext<{ user: User; reload: () => Promise<void> }>({ user: null, reload: async () => undefined });
const vals = (f: HTMLFormElement) => Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
const when = (v: string | null) => (v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

export function Console({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const path = usePathname();
  const reload = useCallback(async () => {
    try {
      let s = await api<{ user: User }>('auth/session');
      if (!s.user && (await refreshSession())) s = await api('auth/session');
      setUser(s.user);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload().catch(() => undefined); }, [reload]);
  if (loading) return <Loading />;
  return (
    <C.Provider value={{ user, reload }}>
      {!user ? <Login /> : !user.isSystemAdmin ? <main className="mx-auto max-w-md p-8"><h1 className="mb-4 text-2xl font-bold">Platform console</h1><Notice kind="error">This console is for platform administrators.</Notice><SignOut /></main> : (
        <div className="mx-auto max-w-6xl px-4 py-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xl font-bold">Platform console</p><nav aria-label="Console" className="flex flex-wrap gap-2">{[['/', 'Overview'], ['/tenants', 'NGOs'], ['/users', 'Users'], ['/jobs', 'Jobs'], ['/audit', 'Audit']].map(([h, l]) => <Link key={h} href={h} aria-current={path === h ? 'page' : undefined} className={`btn btn-sm ${path === h ? 'btn-primary' : 'btn-outline'}`}>{l}</Link>)}<SignOut /></nav></header>
          <main>{!user.mfaEnabled && <Notice kind="error">Turn on two-step verification in My account on the main site. Platform actions need it in production.</Notice>}{children}</main>
        </div>
      )}
    </C.Provider>
  );
}
function SignOut() { const { reload } = useContext(C); return <button className="btn btn-ghost btn-sm" onClick={async () => { await post('auth/logout'); await reload(); }}>Sign out</button>; }
function Login() {
  const { reload } = useContext(C);
  const a = useAction();
  const [challenge, setChallenge] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-sm px-4 py-16"><h1 className="mb-6 text-2xl font-bold">Platform console</h1>
      <form onSubmit={(e) => { e.preventDefault(); const v = vals(e.currentTarget); void a.run(async () => { if (challenge) await post('auth/login/mfa', { challenge, code: v.code }); else { const r = await post('auth/login', { email: v.email, password: v.password }); if (r.mfaRequired) { setChallenge(r.challenge); return; } } await reload(); }); }}>
        <Feedback action={a} />
        {challenge ? <Field label="6-digit code or backup code" required>{(p) => <input {...p} name="code" autoComplete="one-time-code" />}</Field> : <><Field label="Email" required>{(p) => <input {...p} name="email" type="email" autoComplete="username" />}</Field><Field label="Password" required>{(p) => <input {...p} name="password" type="password" autoComplete="current-password" />}</Field></>}
        <button className="btn btn-primary w-full" disabled={a.busy}>Sign in</button>
      </form></main>
  );
}
export function Overview() {
  const { data, error } = useApi('platform/overview');
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!data) return <Loading />;
  const t: [string, string | number][] = [['Raised through the platform', formatMinor(data.raisedMinor)], ['Donations', data.donations], ['Users', data.users], ['Failed jobs', data.deadJobs], ...Object.entries(data.tenants).map(([k, v]) => [`NGOs: ${k.toLowerCase().replace(/_/g, ' ')}`, v as number] as [string, number])];
  return <><h1 className="mb-4 text-2xl font-bold">Overview</h1><ul className="grid gap-4 sm:grid-cols-3">{t.map(([l, v]) => <li key={l} className="card"><p className="text-muted">{l}</p><p className="text-2xl font-bold">{v}</p></li>)}</ul></>;
}
function useList(path: string) { const [page, setPage] = useState(1); const [q, setQ] = useState(''); const r = useApi(`${path}?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`); return { ...r, setPage, q, setQ: (v: string) => { setQ(v); setPage(1); } }; }
const Search = ({ l }: { l: ReturnType<typeof useList> }) => <input type="search" className="input mb-4 max-w-sm" aria-label="Search" placeholder="Search" value={l.q} onChange={(e) => l.setQ(e.target.value)} />;
export function Tenants() {
  const l = useList('platform/tenants');
  const a = useAction();
  const [edit, setEdit] = useState<any>(null);
  return <><h1 className="mb-4 text-2xl font-bold">NGOs</h1><Search l={l} /><Feedback action={a} />
    {l.data && (l.data.items.length ? <Table caption="NGOs" rows={l.data.items} columns={[{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Address' }, { key: 'status', label: 'Status' }, { key: 'm', label: 'Members', render: (t) => t._count.memberships }, { key: 'c', label: 'Legal details', render: (t) => (t.complianceProfile ? 'Filled in' : 'Missing') }, { key: 'f', label: 'FCRA', render: (t) => (t.complianceProfile?.fcraVerifiedAt ? 'Verified' : t.complianceProfile?.fcraNo ? 'To check' : '-') }]} actions={(t) => <button className="btn btn-outline btn-sm" onClick={() => setEdit(t)}>Review</button>} /> : <Empty>No NGOs.</Empty>)}
    {l.data && <Pager {...l.data} onPage={l.setPage} />}
    <Dialog title={edit?.name ?? ''} open={Boolean(edit)} onClose={() => setEdit(null)}>{edit && <>
      <Feedback action={a} /><dl className="mb-4 grid gap-1">{Object.entries(edit.complianceProfile ?? {}).filter(([k, v]) => v && !/^(id|tenantId|createdAt|updatedAt)$/.test(k)).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline">{typeof v === 'object' ? Object.values(v as object).join(', ') : String(v)}</dd></div>)}</dl>
      <form onSubmit={(e) => { e.preventDefault(); const v = vals(e.currentTarget); void a.run(async () => { await put(`platform/tenants/${edit.id}`, { status: v.status, primaryDomain: v.primaryDomain || null }); setEdit(null); await l.reload(); }, 'Saved'); }}><Field label="Status">{(p) => <select {...p} name="status" defaultValue={edit.status}>{['PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}</select>}</Field><Field label="Own domain" hint="Point its DNS here and add a certificate first">{(p) => <input {...p} name="primaryDomain" defaultValue={edit.primaryDomain ?? ''} />}</Field><button className="btn btn-primary" disabled={a.busy}>Save</button></form>
      {edit.complianceProfile?.fcraNo && <form className="mt-6" onSubmit={(e) => { e.preventDefault(); const v = vals(e.currentTarget); void a.run(async () => { await put(`platform/tenants/${edit.id}/fcra`, { verified: !edit.complianceProfile.fcraVerifiedAt, note: v.note }); setEdit(null); await l.reload(); }, 'Saved'); }}><Field label="How was FCRA checked?" required>{(p) => <input {...p} name="note" minLength={5} />}</Field><button className="btn btn-outline" disabled={a.busy}>{edit.complianceProfile.fcraVerifiedAt ? 'Withdraw FCRA approval' : 'Approve FCRA'}</button></form>}
    </>}</Dialog></>;
}
export function Users() {
  const l = useList('platform/users');
  const a = useAction();
  return <><h1 className="mb-4 text-2xl font-bold">Users</h1><Search l={l} /><Feedback action={a} />{l.data && <Table caption="Users" rows={l.data.items} columns={[{ key: 'email', label: 'Email' }, { key: 'n', label: 'Name', render: (u) => `${u.firstName} ${u.lastName}` }, { key: 'o', label: 'NGOs', render: (u) => u.memberships.map((m: any) => m.tenant.slug).join(', ') }, { key: 'status', label: 'Status' }, { key: 'mfaEnabled', label: 'Two-step' }, { key: 'lastLoginAt', label: 'Last sign-in', render: (u) => when(u.lastLoginAt) }]} actions={(u) => u.status !== 'DELETED' && !u.isSystemAdmin && <button className="btn btn-outline btn-sm" disabled={a.busy} onClick={() => window.confirm('Change this account?') && a.run(async () => { await put(`platform/users/${u.id}`, { status: u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' }); await l.reload(); })}>{u.status === 'SUSPENDED' ? 'Restore' : 'Suspend'}</button>} />}{l.data && <Pager {...l.data} onPage={l.setPage} />}</>;
}
export function Jobs() {
  const [status, setStatus] = useState('DEAD');
  const { data, reload } = useApi(`platform/jobs?status=${status}&limit=50`);
  const a = useAction();
  return <><h1 className="mb-4 text-2xl font-bold">Jobs</h1><select className="input mb-4 max-w-xs" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>{['DEAD', 'QUEUED', 'RUNNING', 'DONE'].map((s) => <option key={s}>{s}</option>)}</select><Feedback action={a} />{data && (data.items.length ? <Table caption="Jobs" rows={data.items} columns={[{ key: 'type', label: 'Type' }, { key: 'attempts', label: 'Tries' }, { key: 'lastError', label: 'Error' }, { key: 'createdAt', label: 'Created' }]} actions={(j) => j.status === 'DEAD' && <button className="btn btn-outline btn-sm" onClick={() => a.run(async () => { await post(`platform/jobs/${j.id}/retry`); await reload(); })}>Retry</button>} /> : <Empty>None.</Empty>)}</>;
}
export function Audit() {
  const l = useList('platform/audit');
  return <><h1 className="mb-4 text-2xl font-bold">Audit</h1>{l.data && <Table caption="Audit log" rows={l.data.items} columns={[{ key: 'createdAt', label: 'When' }, { key: 'u', label: 'Who', render: (r) => r.user?.email ?? '-' }, { key: 't', label: 'NGO', render: (r) => r.tenant?.slug ?? '-' }, { key: 'action', label: 'Action', render: (r) => <Badge value={r.action} /> }, { key: 'resource', label: 'What' }, { key: 'ipAddress', label: 'From' }]} />}{l.data && <Pager {...l.data} onPage={l.setPage} />}</>;
}
