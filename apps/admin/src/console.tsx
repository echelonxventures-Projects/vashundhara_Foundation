'use client';
import { api, Badge, del, Dialog, Empty, Feedback, Field, Loading, Notice, Pager, post, put, refreshSession, StructureEditor, Table, useAction, useApi } from '@vashundhara-foundation/ui';
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
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xl font-bold">Platform console</p><nav aria-label="Console" className="flex flex-wrap gap-2">{[['/', 'Overview'], ['/tenants', 'NGOs'], ['/structure', 'Structure'], ['/users', 'Users'], ['/jobs', 'Jobs'], ['/audit', 'Audit']].map(([h, l]) => <Link key={h} href={h} aria-current={path === h ? 'page' : undefined} className={`btn btn-sm ${path === h ? 'btn-primary' : 'btn-outline'}`}>{l}</Link>)}<SignOut /></nav></header>
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

/** Super Admin: one NGO's structure, its permission to manage it, and shared templates. */
export function Structure() {
  const ngos = useApi('platform/tenants?limit=100');
  const [q, setQ] = useState('');
  const found = useApi(q ? `platform/tenants?limit=100&q=${encodeURIComponent(q)}` : null);
  const [id, setId] = useState('');
  const reviews = useApi('platform/structure/reviews');
  const list: any[] = (q ? found.data : ngos.data)?.items ?? [];
  return <><h1 className="mb-4 text-2xl font-bold">Structure</h1>
    <p className="mb-4 text-muted">Fields, tables, forms and rules belong to one NGO. Changing one NGO never changes another.</p>
    {reviews.data?.items.length > 0 && <section className="mb-6"><h2 className="mb-2 text-xl font-semibold">Waiting for your approval ({reviews.data.items.length})</h2><Table caption="Waiting for approval" rows={reviews.data.items} columns={[{ key: 'n', label: 'NGO', render: (r) => r.tenant.name }, { key: 'by', label: 'Sent by' }, { key: 'submittedAt', label: 'When', render: (r) => when(r.submittedAt) }, { key: 'submitNote', label: 'Note' }]} actions={(r) => <button className="btn btn-primary btn-sm" onClick={() => setId(r.tenant.id)}>Review<span className="sr-only"> {r.tenant.name}</span></button>} /></section>}
    <div className="mb-6 grid gap-3 sm:grid-cols-2">{ngos.data?.total > 100 && <Field label="Find an NGO">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>}<Field label="NGO">{(p) => <select {...p} value={id} onChange={(e) => setId(e.target.value)}><option value="">Choose an NGO</option>{id && !list.some((t) => t.id === id) && <option value={id}>{reviews.data?.items.find((r: any) => r.tenant.id === id)?.tenant.name ?? 'Chosen NGO'}</option>}{list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}</Field></div>
    {id ? <div key={id}><Policy id={id} /><StructureEditor base={`platform/structure/ngos/${id}`} platform onPublished={() => void reviews.reload()} /></div> : <Templates ngos={ngos.data?.items ?? []} />}</>;
}
function Policy({ id }: { id: string }) {
  const { data, reload } = useApi(`platform/structure/ngos/${id}/manage`);
  const a = useAction();
  if (!data) return null;
  const p0 = data.policy;
  return <details className="card mb-6"><summary className="cursor-pointer font-semibold">Permission and limits: {p0.ngoAdminAllowed ? (p0.ngoAdminPublish ? 'the NGO Administrator may change and publish' : 'the NGO Administrator may change, you approve each publish') : 'Super Admin only'}</summary>
    <form className="mt-4" key={JSON.stringify(p0)} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void a.run(async () => { await put(`platform/structure/ngos/${id}/policy`, { ngoAdminAllowed: f.get('ngoAdminAllowed') === 'on', ngoAdminPublish: f.get('ngoAdminPublish') === 'on', ...Object.fromEntries(['maxFields', 'maxTables', 'maxForms', 'maxRules'].map((k) => [k, Number(f.get(k))])) }); await reload(); }, 'Saved'); }}><Feedback action={a} />
      <label className="check"><input type="checkbox" name="ngoAdminAllowed" defaultChecked={p0.ngoAdminAllowed} /><span>Let the NGO Administrator change the structure<span className="field-hint block">They can prepare changes and send them to you for review. Deleting for good stays with Super Admin.</span></span></label>
      <label className="check"><input type="checkbox" name="ngoAdminPublish" defaultChecked={p0.ngoAdminPublish} /><span>Let the NGO Administrator publish without approval<span className="field-hint block">Only works together with the permission above. Off: you approve each publish.</span></span></label>
      <div className="grid gap-3 sm:grid-cols-4">{[['maxFields', 'Most fields'], ['maxTables', 'Most tables'], ['maxForms', 'Most forms'], ['maxRules', 'Most rules']].map(([k, l]) => <Field key={k} label={l}>{(p) => <input {...p} name={k} type="number" min={0} defaultValue={p0[k]} />}</Field>)}</div><button className="btn btn-primary" disabled={a.busy}>Save</button></form></details>;
}
function Templates({ ngos }: { ngos: any[] }) {
  const { data, reload } = useApi('platform/structure/templates');
  const a = useAction();
  const [add, setAdd] = useState(false);
  const [use, setUse] = useState<any>(null);
  const [res, setRes] = useState<any[] | null>(null);
  return <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Templates</h2><button className="btn btn-outline btn-sm" onClick={() => setAdd(true)}>New template</button></div><Feedback action={a} />
    {data?.items.length ? <Table caption="Templates" rows={data.items} columns={[{ key: 'name', label: 'Name' }, { key: 'description', label: 'About' }, { key: 'isDefault', label: 'Given to new NGOs' }]} actions={(t) => <span className="inline-flex flex-wrap gap-1"><button className="btn btn-outline btn-sm" onClick={() => { setRes(null); setUse(t); }}>Give to NGOs</button><button className="btn btn-outline btn-sm" disabled={a.busy} onClick={() => a.run(async () => { await put(`platform/structure/templates/${t.id}`, { isDefault: !t.isDefault }); await reload(); }, 'Saved')}>{t.isDefault ? 'Stop giving to new NGOs' : 'Give to new NGOs'}</button><button className="btn btn-danger btn-sm" disabled={a.busy} onClick={() => window.confirm('Delete this template? NGOs that already have it keep their structure.') && a.run(async () => { await del(`platform/structure/templates/${t.id}`); await reload(); }, 'Deleted')}>Delete</button></span>} /> : <Empty>No templates yet. Build the structure of one NGO, publish it, then copy it here.</Empty>}
    <Dialog title="New template" open={add} onClose={() => setAdd(false)}><form onSubmit={(e) => { e.preventDefault(); const v = vals(e.currentTarget); void a.run(async () => { await post('platform/structure/templates', { name: v.name, description: v.description || undefined, fromTenantId: v.from }); setAdd(false); await reload(); }, 'Saved'); }}><Feedback action={a} /><Field label="Name" required>{(p) => <input {...p} name="name" maxLength={80} />}</Field><Field label="About">{(p) => <input {...p} name="description" maxLength={500} />}</Field><Field label="Copy the live structure of" required>{(p) => <select {...p} name="from">{ngos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}</Field><button className="btn btn-primary" disabled={a.busy}>Save</button></form></Dialog>
    <Dialog title={`Give to NGOs: ${use?.name ?? ''}`} open={Boolean(use)} onClose={() => setUse(null)}>{use && (res ? <ul className="grid gap-2">{res.map((r) => <li key={r.id} className="card"><strong>{r.name}</strong> <Badge value={r.status} />{r.message && <p>{r.message}</p>}{r.skipped?.length > 0 && <p className="text-muted">Already there, left alone: {r.skipped.join(', ')}</p>}</li>)}</ul> : <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const ids = f.getAll('id'); void a.run(async () => setRes((await post(`platform/structure/templates/${use.id}/apply`, { tenantIds: f.get('all') === 'on' ? 'ALL' : ids, publish: f.get('publish') === 'on' })).results)); }}><Feedback action={a} /><label className="check"><input type="checkbox" name="all" /><span>Every NGO</span></label><fieldset className="mb-4"><legend className="font-semibold">Or choose</legend>{ngos.map((t) => <label key={t.id} className="flex items-center gap-2"><input type="checkbox" name="id" value={t.id} />{t.name}</label>)}</fieldset><label className="check"><input type="checkbox" name="publish" /><span>Publish straight away<span className="field-hint block">Otherwise it waits in the draft of each NGO. Nothing an NGO already has is overwritten.</span></span></label><button className="btn btn-primary" disabled={a.busy}>Give to NGOs</button></form>)}</Dialog></section>;
}
