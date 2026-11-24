'use client';
import { formatMinor, toMinor, type Permission } from '@vashundhara-foundation/shared';
import { api, Badge, del, Dialog, Empty, Feedback, Field, Loading, Notice, Pager, post, put, saveText, Table, uploadFile, useAction, useApi } from '@vashundhara-foundation/ui';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { Check, TextArea, TextField, values } from './forms';
import { useSession } from './session';
import { F, R, STAFF } from './staff-config';

const rupees = (m: unknown) => formatMinor(Number(m ?? 0));
const dig = (o: any, p: string) => p.split('.').reduce((x, k) => x?.[k], o);
function cellValue(key: string, r: any): ReactNode {
  const v = dig(r, key);
  if (key.endsWith('Minor')) return v === undefined || v === null ? '-' : rupees(v);
  if (key === 'pipelineStages') return v?.map((s: any) => s.name).join(' → ');
  if (v === null || v === undefined || v === '') return <span className="text-muted">-</span>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) return new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  if (typeof v === 'string' && /^[A-Z][A-Z0-9_]+$/.test(v)) return <Badge value={v} />;
  const s = String(v);
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
}
const cell = (key: string) => (r: any) => cellValue(key, r);

const SPECIAL: { href: string; title: string; group: string; perm: Permission }[] = [
  { href: 'donations', title: 'Donations', group: 'Fundraising', perm: 'donations:read' }, { href: 'finance', title: 'Finance', group: 'Fundraising', perm: 'finance:read' }, { href: 'monitoring', title: 'Monitoring', group: 'Programmes', perm: 'programmes:read' },
  { href: 'members', title: 'Team', group: 'Setup', perm: 'members:read' }, { href: 'roles', title: 'Roles', group: 'Setup', perm: 'roles:read' }, { href: 'settings', title: 'Website', group: 'Setup', perm: 'settings:read' }, { href: 'compliance', title: 'Legal and payments', group: 'Setup', perm: 'compliance:read' }, { href: 'api-keys', title: 'API keys', group: 'Setup', perm: 'api_keys:read' }, { href: 'modules', title: 'Modules', group: 'Setup', perm: 'feature_flags:read' }
];
const GROUPS = ['Fundraising', 'CRM', 'Volunteering', 'Programmes', 'Learning', 'Outreach', 'CSR', 'Setup'];

export function StaffShell({ children }: { children: ReactNode }) {
  const { me, loading, can } = useSession();
  const router = useRouter();
  const path = usePathname();
  const flags = useApi<Record<string, unknown>>('feature-flags/evaluate');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ type: string; id: string; title: string }[]>([]);
  useEffect(() => { if (!loading && !me?.user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [loading, me, path, router]);
  useEffect(() => { setOpen(false); setHits([]); setQ(''); }, [path]);
  useEffect(() => { if (q.length < 2) { setHits([]); return; } const x = setTimeout(() => { api(`search?q=${encodeURIComponent(q)}`).then((r) => setHits(r.items)).catch(() => undefined); }, 300); return () => clearTimeout(x); }, [q]);
  if (loading || !me?.user) return <Loading />;
  if (!me.permissions.length) return <div className="mx-auto max-w-lg p-8"><Notice kind="error">Your account has no staff access in this organisation.</Notice></div>;
  const items = [...SPECIAL.filter((s) => can(s.perm)).map((s) => ({ href: s.href, title: s.title, group: s.group })), ...Object.entries(STAFF).filter(([, r]) => can(`${r.resource}:read`) && (!r.flag || flags.data?.[`module.${r.flag}`] !== false)).map(([href, r]) => ({ href, title: r.title, group: r.group }))];
  const bySlug = (type: string) => (Object.entries(STAFF).find(([, r]) => r.path === type)?.[0] ?? type);
  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[230px_1fr]">
      <aside>
        <button type="button" className="btn btn-outline w-full lg:hidden" aria-expanded={open} aria-controls="snav" onClick={() => setOpen(!open)}>Staff menu</button>
        <nav id="snav" aria-label="Staff" className={`${open ? 'block' : 'hidden'} mt-3 lg:mt-0 lg:block`}>
          <input type="search" className="input mb-3" aria-label="Search records" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.length > 0 && <ul className="card mb-3 grid gap-1">{hits.map((h) => <li key={h.type + h.id}><Link className="underline" href={`/staff/${bySlug(h.type)}?open=${h.id}`}>{h.title}</Link></li>)}</ul>}
          <Link href="/staff" className="block rounded px-2 py-1 font-semibold hover:bg-brand-soft">Dashboard</Link>
          {GROUPS.map((g) => { const xs = items.filter((i) => i.group === g); return xs.length ? <div key={g} className="mt-4"><p className="px-2 text-sm font-semibold text-muted">{g}</p><ul>{xs.map((i) => <li key={i.href}><Link href={`/staff/${i.href}`} aria-current={path === `/staff/${i.href}` ? 'page' : undefined} className="block rounded px-2 py-1 hover:bg-brand-soft aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold">{i.title}</Link></li>)}</ul></div> : null; })}
          {can('field:create') && <Link href="/field" className="btn btn-outline mt-4 w-full">Field app</Link>}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
const H1 = ({ children, side }: { children: ReactNode; side?: ReactNode }) => <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{children}</h1><div className="flex flex-wrap gap-2">{side}</div></div>;

// ---------- generic list and form ----------
const local = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
function RefInput({ f, value, pipelineId, ...a }: { f: F; value: string; pipelineId?: string } & Record<string, any>) {
  const { data } = useApi(`${f.ref!.path}?limit=100`);
  const opts: [string, string][] = f.ref!.label === 'stages'
    ? (data?.items.find((p: any) => p.id === pipelineId)?.pipelineStages ?? []).map((s: any) => [s.id, s.name])
    : (data?.items ?? []).map((x: any) => [x.id, f.ref!.label.split(' ').map((k) => x[k]).join(' ')]);
  if (value && !opts.some(([id]) => id === value)) opts.push([value, 'Current value']);
  return <select {...a} name={f.key} defaultValue={value} key={`${opts.length}${pipelineId ?? ''}`}><option value="">-</option>{opts.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>;
}
function FileInput({ f, value, onChange, ...a }: { f: F; value: string | null; onChange: (id: string) => void } & Record<string, any>) {
  const [state, setState] = useState(value ? 'A file is attached' : '');
  return <div><input {...a} type="file" accept={f.type === 'image' ? 'image/jpeg,image/png,image/webp' : undefined} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setState('Uploading…'); try { onChange(await uploadFile(file, f.type === 'image')); setState('Uploaded. It can be used once the virus scan finishes.'); } catch (x) { setState((x as Error).message); } }} /><p className="field-hint" role="status">{state}</p></div>;
}
function encode(fields: F[], form: HTMLFormElement, files: Record<string, string>, original: any): Record<string, unknown> {
  const fd = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (original && f.createOnly) continue;
    if (f.type === 'image' || f.type === 'file') { if (files[f.key]) out[f.key] = files[f.key]; continue; }
    if (f.type === 'bool') { out[f.key] = fd.get(f.key) === 'on'; continue; }
    if (f.type === 'multi') { out[f.key] = fd.getAll(f.key); continue; }
    const raw = String(fd.get(f.key) ?? '').trim();
    if (f.type === 'tags') { out[f.key] = raw.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean); continue; }
    if (raw === '') { if (original && original[f.key] && !f.required && f.type !== 'select') out[f.key] = null; continue; }
    if (f.type === 'stages') { out[f.key] = raw.split('\n').filter(Boolean).map((l) => { const [name, p] = l.split(','); return { name: name.trim(), probability: Number(p ?? 0) }; }); continue; }
    if (f.type === 'money') { const m = toMinor(raw); if (m === null) throw new Error(`${f.label}: enter an amount`); out[f.key] = m; continue; }
    if (f.type === 'number') { out[f.key] = Number(raw); continue; }
    if (f.type === 'date') { out[f.key] = `${raw}T00:00:00+05:30`; continue; }
    if (f.type === 'datetime') { out[f.key] = new Date(raw).toISOString(); continue; }
    if (f.type === 'address') { out[f.key] = { line: raw }; continue; }
    out[f.key] = f.key === 'pan' ? raw.toUpperCase() : raw;
  }
  return out;
}
function RecordForm({ r, row, onDone }: { r: R; row: any | null; onDone: (res: any) => void }) {
  const a = useAction();
  const [files, setFiles] = useState<Record<string, string>>({});
  const [pipelineId, setPipelineId] = useState<string | undefined>(row?.pipelineId);
  return (
    <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; void a.run(async () => { const body = encode(r.fields, form, files, row); onDone(row ? await put(`${r.path}/${row.id}`, body) : await post(r.path, body)); }); }}>
      <Feedback action={a} />
      {r.fields.filter((f) => !(row && f.createOnly)).map((f) => {
        const v = row?.[f.key];
        if (f.type === 'bool') return <Check key={f.key} name={f.key} label={f.label} defaultChecked={v ?? f.key === 'isActive'} />;
        if (f.type === 'multi') return <fieldset key={f.key} className="mb-4"><legend className="font-semibold">{f.label}</legend><div className="flex flex-wrap gap-3">{f.options!.map((o) => <label key={o} className="flex items-center gap-2"><input type="checkbox" name={f.key} value={o} defaultChecked={v?.includes(o)} />{o.toLowerCase().replace(/_/g, ' ')}</label>)}</div></fieldset>;
        return (
          <Field key={f.key} label={f.label} hint={f.hint} required={f.required} error={a.error?.field(f.key)}>{(p) => {
            if (f.type === 'ref') return <RefInput f={f} value={v ?? ''} pipelineId={pipelineId} {...p} onChange={f.key === 'pipelineId' ? (e: React.ChangeEvent<HTMLSelectElement>) => setPipelineId(e.target.value) : undefined} />;
            if (f.type === 'image' || f.type === 'file') return <FileInput f={f} value={v} {...p} required={false} onChange={(id) => setFiles((s) => ({ ...s, [f.key]: id }))} />;
            if (f.type === 'select') return <select {...p} name={f.key} defaultValue={v ?? (f.required ? f.options![0] : '')}>{!f.required && !v && <option value="">-</option>}{f.options!.map((o) => <option key={o} value={o}>{o.toLowerCase().replace(/_/g, ' ')}</option>)}</select>;
            if (f.type === 'textarea' || f.type === 'stages') return <textarea {...p} name={f.key} rows={f.type === 'stages' ? 5 : 6} defaultValue={v ?? ''} />;
            const def = f.type === 'money' ? (v !== undefined && v !== null ? String(v / 100) : '') : f.type === 'date' ? local(v).slice(0, 10) : f.type === 'datetime' ? local(v) : f.type === 'tags' ? (v ?? []).join(', ') : f.type === 'address' ? Object.values(v ?? {}).join(', ') : f.key === 'pan' ? '' : v ?? '';
            const type = ({ email: 'email', number: 'number', date: 'date', datetime: 'datetime-local' } as Record<string, string>)[f.type ?? ''] ?? 'text';
            return <input {...p} name={f.key} type={type} step="any" inputMode={f.type === 'money' ? 'decimal' : undefined} defaultValue={def} />;
          }}</Field>
        );
      })}
      <button className="btn btn-primary" disabled={a.busy}>Save</button>
    </form>
  );
}
export function Resource({ name }: { name: string }) {
  const r = STAFF[name];
  const { can } = useSession();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState('');
  const [edit, setEdit] = useState<any | 'new' | null>(null);
  const [once, setOnce] = useState<string | null>(null);
  useEffect(() => { const x = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(x); }, [q]);
  const { data, error, loading, reload } = useApi(`${r.path}?page=${page}&limit=20${term ? `&q=${encodeURIComponent(term)}` : ''}${filter && r.filter ? `&${r.filter.key}=${filter}` : ''}`);
  const a = useAction();
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('open'); if (id && !r.noEdit) api(`${r.path}/${id}`).then(setEdit).catch(() => undefined); }, [r]);
  const actions = (row: any) => (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {r.links?.map((l) => l.href(row).startsWith('/api/') ? <a key={l.label} className="btn btn-outline btn-sm" href={l.href(row)}>{l.label}</a> : <Link key={l.label} className="btn btn-outline btn-sm" href={l.href(row)}>{l.label}</Link>)}
      {r.actions?.filter((x) => can(x.perm) && (!x.when || x.when(row))).map((x) => <button key={x.label} className="btn btn-outline btn-sm" disabled={a.busy} onClick={() => (!x.confirm || window.confirm(x.confirm)) && a.run(async () => { await api(x.url(row), { method: x.method, body: x.body?.(row) ?? {} }); await reload(); }, `${x.label}: done`)}>{x.label}</button>)}
      {!r.noEdit && can(`${r.resource}:update`) && <button className="btn btn-outline btn-sm" onClick={() => setEdit(row)}>Edit</button>}
      {!r.noDelete && can(`${r.resource}:delete`) && <button className="btn btn-danger btn-sm" disabled={a.busy} onClick={() => window.confirm('Delete this record?') && a.run(async () => { await del(`${r.path}/${row.id}`); await reload(); }, 'Deleted')}>Delete</button>}
    </span>
  );
  return (
    <>
      <H1 side={<>{name === 'donors' && can('donors:export') && <button className="btn btn-outline" onClick={() => a.run(async () => { const x = await api('donor-tools/export'); saveText(x.filename, x.csv); })}>Export</button>}{name === 'donors' && can('donors:import') && <ImportDonors onDone={reload} />}{name === 'audit' && can('audit_logs:export') && <button className="btn btn-outline" onClick={() => a.run(async () => { const x = await api('audit-logs/export'); saveText(x.filename, x.csv); })}>Export</button>}{!r.noCreate && can(`${r.resource}:create`) && <button className="btn btn-primary" onClick={() => setEdit('new')}>Add</button>}</>}>{r.title}</H1>
      <div className="mb-4 flex flex-wrap gap-3">{r.search && <input type="search" className="input max-w-xs" aria-label={`Search ${r.title}`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />}{r.filter && <select className="input max-w-[220px]" aria-label="Filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="">All</option>{r.filter.options.map((o) => <option key={o} value={o}>{o.toLowerCase().replace(/_/g, ' ')}</option>)}</select>}</div>
      <Feedback action={a} />{once && <Notice kind="ok">Copy this now, it is shown only once: <code className="break-all">{once}</code></Notice>}
      {error ? <Notice kind="error">{error.message}</Notice> : loading && !data ? <Loading /> : !data?.items.length ? <Empty>Nothing here yet.</Empty> : <Table caption={r.title} columns={r.columns.map(([key, label]) => ({ key, label, render: cell(key) }))} rows={data.items} actions={actions} />}
      {data?.total > 0 && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      <Dialog title={edit === 'new' ? `Add: ${r.title}` : `Edit: ${r.title}`} open={edit !== null} onClose={() => setEdit(null)}>{edit !== null && <RecordForm key={edit === 'new' ? 'new' : edit.id} r={r} row={edit === 'new' ? null : edit} onDone={(res) => { setEdit(null); setOnce(res?.secret ?? null); void reload(); }} />}</Dialog>
    </>
  );
}
function ImportDonors({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<any>(null);
  const a = useAction();
  return <><button className="btn btn-outline" onClick={() => { setOpen(true); setRes(null); }}>Import</button><Dialog title="Import donors" open={open} onClose={() => setOpen(false)}><p className="mb-3">CSV with the columns fullName, email, phone, pan, isIndianCitizen.</p><Feedback action={a} /><input type="file" accept=".csv" aria-label="CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await a.run(async () => { setRes(await post('donor-tools/import', { csv: await f.text() })); onDone(); }); }} />{res && <Notice kind="ok"><p>{res.created} added, {res.skipped} already there.</p>{res.errors.length > 0 && <ul>{res.errors.map((x: any) => <li key={x.row}>Row {x.row}: {x.message}</li>)}</ul>}</Notice>}</Dialog></>;
}

// ---------- special screens ----------
export function Dashboard() {
  const { can } = useSession();
  const { data, error } = useApi(can('reports:read') ? 'reports/dashboard' : null);
  const months = useApi(can('reports:read') ? 'reports/monthly' : null);
  if (!can('reports:read')) return <><H1>Welcome</H1><p>Choose a section from the menu.</p></>;
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!data) return <Loading />;
  const change = data.previous30Minor ? Math.round(((data.last30Minor - data.previous30Minor) / data.previous30Minor) * 100) : null;
  const max = Math.max(1, ...(months.data?.items ?? []).map((m: any) => m.amountMinor));
  const tiles: [string, string, string?][] = [['Raised in total', rupees(data.raisedMinor)], ['Last 30 days', rupees(data.last30Minor), change === null ? undefined : `${change >= 0 ? '+' : ''}${change}% on the 30 days before`], ['Donors', String(data.donors)], ['Active campaigns', String(data.campaigns)], ['Active volunteers', String(data.volunteers)], ['Beneficiaries', String(data.beneficiaries)], ['Students', String(data.students)]];
  return (
    <>
      <H1>Dashboard</H1>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{tiles.map(([l, v, s]) => <li key={l} className="card"><p className="text-muted">{l}</p><p className="text-2xl font-bold">{v}</p>{s && <p className="text-sm text-muted">{s}</p>}</li>)}</ul>
      {months.data?.items.length > 0 && <section className="card mt-6"><h2 className="mb-3 text-lg font-semibold">Raised by month</h2><ul className="grid gap-2">{months.data.items.map((m: any) => <li key={m.month} className="grid grid-cols-[70px_1fr_110px] items-center gap-3"><span>{m.month}</span><span className="bar"><span style={{ width: `${(m.amountMinor / max) * 100}%` }} /></span><span className="text-end">{rupees(m.amountMinor)}</span></li>)}</ul></section>}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card"><h2 className="mb-3 text-lg font-semibold">Recent donations</h2><ul className="divide-y divide-line">{data.recent.map((d: any) => <li key={d.id} className="flex justify-between gap-3 py-2"><span>{d.donor.fullName}{d.campaign && <span className="text-muted"> · {d.campaign.title}</span>}</span><strong>{rupees(d.amountMinor)}</strong></li>)}</ul></section>
        <section className="card"><h2 className="mb-3 text-lg font-semibold">Top campaigns</h2><ul className="grid gap-3">{data.topCampaigns.map((c: any) => <li key={c.title}><div className="flex justify-between"><span>{c.title}</span><strong>{rupees(c.raisedMinor)}</strong></div>{c.goalMinor > 0 && <div className="bar mt-1"><span style={{ width: `${Math.min(100, (c.raisedMinor / c.goalMinor) * 100)}%` }} /></div>}</li>)}</ul></section>
      </div>
    </>
  );
}
export function Donations() {
  const { can } = useSession();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, reload } = useApi(`donations?page=${page}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const [refund, setRefund] = useState<any>(null);
  const [add, setAdd] = useState(false);
  const a = useAction();
  return (
    <>
      <H1 side={<>{can('donations:export') && <button className="btn btn-outline" onClick={() => a.run(async () => { const x = await api(`donations/export${status ? `?status=${status}` : ''}`); saveText(x.filename, x.csv); })}>Export</button>}{can('donations:create') && <button className="btn btn-primary" onClick={() => setAdd(true)}>Record offline gift</button>}</>}>Donations</H1>
      <div className="mb-4 flex flex-wrap gap-3"><input type="search" className="input max-w-xs" aria-label="Search donations" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /><select className="input max-w-[220px]" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option>{['COMPLETED', 'PENDING', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.toLowerCase().replace(/_/g, ' ')}</option>)}</select></div>
      <Feedback action={a} />
      {loading && !data ? <Loading /> : !data?.items.length ? <Empty>Nothing here yet.</Empty> : <Table caption="Donations" rows={data.items} columns={[{ key: 'createdAt', label: 'Date', render: cell('createdAt') }, { key: 'donor', label: 'Donor', render: cell('donor.fullName') }, { key: 'amountMinor', label: 'Amount', render: cell('amountMinor') }, { key: 'campaign', label: 'Campaign', render: cell('campaign.title') }, { key: 'method', label: 'Method' }, { key: 'status', label: 'Status' }]}
        actions={(d) => <span className="inline-flex gap-1">{d.receipts[0] && can('receipts:read') && <a className="btn btn-outline btn-sm" href={`/api/receipts/${d.receipts[0].id}/pdf`}>Receipt</a>}{can('refunds:create') && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(d.status) && d.method !== 'IN_KIND' && <button className="btn btn-danger btn-sm" onClick={() => setRefund(d)}>Refund</button>}</span>} />}
      {data?.total > 0 && <Pager {...data} onPage={setPage} />}
      <Dialog title="Refund" open={Boolean(refund)} onClose={() => setRefund(null)}>{refund && <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(async () => { const m = toMinor(v.amount ?? ''); if (!m) throw new Error(); await post(`donations/${refund.id}/refunds`, { amountMinor: m, reason: v.reason }); setRefund(null); await reload(); }, 'Refund requested'); }}><Feedback action={a} /><TextField name="amount" label="Amount (rupees)" defaultValue={String((refund.amountMinor - refund.refundedMinor) / 100)} required inputMode="decimal" /><TextField name="reason" label="Reason" required minLength={5} /><button className="btn btn-danger" disabled={a.busy}>Refund</button></form>}</Dialog>
      <Dialog title="Record offline gift" open={add} onClose={() => setAdd(false)}><OfflineForm onDone={() => { setAdd(false); void reload(); }} /></Dialog>
    </>
  );
}
function OfflineForm({ onDone }: { onDone: () => void }) {
  const a = useAction();
  const donors = useApi('donors?limit=100&sort=fullName');
  const campaigns = useApi('campaigns?limit=100');
  const [donorId, setDonorId] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(async () => { const m = toMinor(v.amount ?? ''); if (!m) throw new Error(); await post('donations', { amountMinor: m, method: v.method, receivedAt: `${v.receivedAt}T12:00:00+05:30`, reference: v.reference, campaignId: v.campaignId, wants80G: v.wants80G === 'on', ...(donorId ? { donorId } : { donor: { fullName: v.fullName, email: v.email, pan: v.pan, isIndianCitizen: v.citizen === 'on' } }) }); onDone(); }); }}>
      <Feedback action={a} />
      <Field label="Donor">{(p) => <select {...p} value={donorId} onChange={(e) => setDonorId(e.target.value)}><option value="">New donor</option>{donors.data?.items.map((d: any) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select>}</Field>
      {!donorId && <><TextField name="fullName" label="Name" required /><TextField name="email" type="email" label="Email" /><TextField name="pan" label="PAN" maxLength={10} /><Check name="citizen" label="Indian citizen" defaultChecked /></>}
      <TextField name="amount" label="Amount (rupees)" required inputMode="decimal" />
      <Field label="Method">{(p) => <select {...p} name="method">{['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'IN_KIND'].map((m) => <option key={m} value={m}>{m.toLowerCase().replace(/_/g, ' ')}</option>)}</select>}</Field>
      <TextField name="receivedAt" type="date" label="Received on" required /><TextField name="reference" label="Cheque or transfer number" />
      <Field label="Campaign">{(p) => <select {...p} name="campaignId"><option value="">-</option>{campaigns.data?.items.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>}</Field>
      <Check name="wants80G" label="80G receipt" hint="Not allowed for cash above Rs 2,000. Needs PAN." /><button className="btn btn-primary" disabled={a.busy}>Save</button>
    </form>
  );
}
export function Finance() {
  const { can } = useSession();
  const y = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0);
  const [from, setFrom] = useState(`${y}-04-01`);
  const [to, setTo] = useState(`${y + 1}-04-01`);
  const range = `from=${from}&to=${to}`;
  const tb = useApi(`finance/trial-balance?${range}`);
  const un = useApi('finance/unsettled');
  const a = useAction();
  const [res, setRes] = useState<any>(null);
  return (
    <>
      <H1 side={can('finance:export') && <><button className="btn btn-outline" onClick={() => a.run(async () => { const x = await api(`finance/ledger/export?${range}`); saveText(x.filename, x.csv); })}>Ledger</button><button className="btn btn-outline" onClick={() => a.run(async () => { const x = await api(`finance/form-10bd?fy=${y}-${String((y + 1) % 100).padStart(2, '0')}`); saveText(x.filename, x.csv); setRes({ tenBd: x }); })}>Form 10BD file</button></>}>Finance</H1>
      <Feedback action={a} />{res?.tenBd && <Notice>{res.tenBd.included} donations listed; {res.tenBd.excluded} left out because they have no 80G receipt. Check the file against the current Form 10BD template before filing.</Notice>}
      <div className="mb-4 flex flex-wrap gap-3"><TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} /><TextField type="date" label="To (not included)" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {tb.data && <><p className="mb-2">{tb.data.balanced ? <span className="badge badge-ok">balanced</span> : <span className="badge badge-bad">not balanced</span>}</p>{tb.data.items.length ? <Table caption="Trial balance" rows={tb.data.items.map((x: any) => ({ ...x, id: x.fund + x.account }))} columns={[{ key: 'fund', label: 'Fund' }, { key: 'account', label: 'Account' }, { key: 'debitMinor', label: 'Debit', render: cell('debitMinor') }, { key: 'creditMinor', label: 'Credit', render: cell('creditMinor') }]} /> : <Empty>No entries in this period.</Empty>}</>}
      <h2 className="mb-2 mt-8 text-lg font-semibold">Waiting for settlement</h2>{un.data && <p>{un.data.total} payments, {rupees(un.data.amountMinor)}</p>}
      {can('finance:manage') && <div className="card mt-4"><p className="mb-2">Upload a settlement CSV: payment_id, fee, settlement_id, settled_on.</p><input type="file" accept=".csv" aria-label="Settlement CSV" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await a.run(async () => { setRes({ settle: await post('finance/settlements', { csv: await f.text() }) }); await Promise.all([tb.reload(), un.reload()]); }); }} />{res?.settle && <Notice kind="ok">{res.settle.settled} settled, {res.settle.already} already done{res.settle.unknown.length > 0 && `, unknown: ${res.settle.unknown.join(', ')}`}{res.settle.errors.length > 0 && `. ${res.settle.errors.join('; ')}`}</Notice>}</div>}
    </>
  );
}
export function Monitoring() {
  const { data } = useApi('monitoring');
  if (!data) return <Loading />;
  return <><H1 side={<><Link className="btn btn-outline" href="/staff/indicators">Targets</Link><Link className="btn btn-outline" href="/staff/readings">Readings</Link></>}>Monitoring</H1>{!data.items.length && <Empty>Publish a programme and add targets to see progress.</Empty>}<div className="grid gap-5">{data.items.map((p: any) => <section key={p.id} className="card"><h2 className="text-lg font-semibold">{p.name}</h2><ul className="mt-3 grid gap-4">{p.indicators.map((i: any) => <li key={i.id}><div className="flex justify-between gap-3"><span>{i.name}</span><span>{i.latest} of {i.target} {i.unit} ({i.progress}%)</span></div><div className="bar mt-1"><span style={{ width: `${Math.max(0, Math.min(100, i.progress))}%` }} /></div></li>)}</ul></section>)}</div></>;
}
export function Members() {
  const { can, me } = useSession();
  const { data, reload } = useApi('members?limit=100');
  const inv = useApi('members/invitations');
  const roles = useApi(can('roles:read') ? 'roles' : null);
  const orgs = useApi(can('crm:read') ? 'crm/organizations?limit=100' : null);
  const [edit, setEdit] = useState<any>(null);
  const [invite, setInvite] = useState(false);
  const a = useAction();
  const Roles = ({ has }: { has: string[] }) => <fieldset className="mb-4"><legend className="font-semibold">Roles</legend>{roles.data?.items.map((r: any) => <label key={r.id} className="check"><input type="checkbox" name="roleIds" value={r.id} defaultChecked={has.includes(r.id)} /><span>{r.displayName}</span></label>)}</fieldset>;
  const picked = (f: HTMLFormElement) => new FormData(f).getAll('roleIds').map(String);
  const Org = ({ v }: { v?: string | null }) => <Field label="Company (for CSR partners)">{(p) => <select {...p} name="organizationId" defaultValue={v ?? ''}><option value="">-</option>{orgs.data?.items.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}</Field>;
  return (
    <>
      <H1 side={can('members:create') && <button className="btn btn-primary" onClick={() => setInvite(true)}>Invite</button>}>Team</H1><Feedback action={a} />
      {data && <Table caption="Members" rows={data.items} columns={[{ key: 'n', label: 'Name', render: (m) => `${m.user.firstName} ${m.user.lastName}` }, { key: 'e', label: 'Email', render: (m) => m.user.email }, { key: 'r', label: 'Roles', render: (m) => m.roles.map((r: any) => r.displayName).join(', ') }, { key: 'status', label: 'Status' }, { key: 'mfa', label: 'Two-step', render: (m) => (m.user.mfaEnabled ? 'On' : 'Off') }]} actions={(m) => m.user.id !== me?.user?.id && can('members:update') && <button className="btn btn-outline btn-sm" onClick={() => setEdit(m)}>Change</button>} />}
      {inv.data?.items.length > 0 && <><h2 className="mb-2 mt-6 text-lg font-semibold">Waiting invitations</h2><ul className="grid gap-2">{inv.data.items.map((i: any) => <li key={i.id} className="card flex justify-between"><span>{i.email}</span>{can('members:delete') && <button className="btn btn-danger btn-sm" onClick={() => a.run(async () => { await del(`members/invitations/${i.id}`); await inv.reload(); })}>Cancel</button>}</li>)}</ul></>}
      <Dialog title="Invite" open={invite} onClose={() => setInvite(false)}><form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); void a.run(async () => { await post('members/invitations', { email: v.email, roleIds: picked(f), organizationId: v.organizationId }); setInvite(false); await inv.reload(); }, 'Invitation sent'); }}><Feedback action={a} /><TextField name="email" type="email" label="Email" required /><Roles has={[]} /><Org /><button className="btn btn-primary" disabled={a.busy}>Send</button></form></Dialog>
      <Dialog title="Change access" open={Boolean(edit)} onClose={() => setEdit(null)}>{edit && <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); void a.run(async () => { await put(`members/${edit.id}`, { status: v.status, roleIds: picked(f), organizationId: v.organizationId ?? null }); setEdit(null); await reload(); }, 'Saved'); }}><Feedback action={a} /><Roles has={edit.roles.map((r: any) => r.id)} /><Org v={edit.organizationId} /><Field label="Status">{(p) => <select {...p} name="status" defaultValue={edit.status}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>}</Field><button className="btn btn-primary" disabled={a.busy}>Save</button>{can('members:delete') && <button type="button" className="btn btn-danger ms-3" onClick={() => window.confirm('Remove this person from the organisation?') && a.run(async () => { await del(`members/${edit.id}`); setEdit(null); await reload(); }, 'Removed')}>Remove</button>}</form>}</Dialog>
    </>
  );
}
function PermissionPicker({ has }: { has: string[] }) {
  const { data } = useApi<{ items: string[] }>('roles/permissions');
  const { can } = useSession();
  const groups = useMemo(() => { const m = new Map<string, string[]>(); for (const p of data?.items ?? []) { const k = p.split(':')[0]; m.set(k, [...(m.get(k) ?? []), p]); } return [...m]; }, [data]);
  return <div className="mb-4 grid gap-2">{groups.map(([g, ps]) => <fieldset key={g}><legend className="font-semibold">{g.replace(/_/g, ' ')}</legend><div className="flex flex-wrap gap-3">{ps.map((p) => <label key={p} className="flex items-center gap-1"><input type="checkbox" name="permissions" value={p} defaultChecked={has.includes(p)} disabled={!can(p)} />{p.split(':')[1]}</label>)}</div></fieldset>)}</div>;
}
export function Roles() {
  const { can } = useSession();
  const { data, reload } = useApi('roles');
  const [edit, setEdit] = useState<any>(null);
  const a = useAction();
  return <><H1 side={can('roles:create') && <button className="btn btn-primary" onClick={() => setEdit('new')}>Add role</button>}>Roles</H1><Feedback action={a} />{data && <Table caption="Roles" rows={data.items} columns={[{ key: 'displayName', label: 'Role' }, { key: 'k', label: 'Kind', render: (r) => (r.isSystem ? 'Built in' : 'Your own') }, { key: 'p', label: 'Permissions', render: (r) => r.permissions.length }]} actions={(r) => !r.isSystem && <span className="inline-flex gap-1">{can('roles:update') && <button className="btn btn-outline btn-sm" onClick={() => setEdit(r)}>Edit</button>}{can('roles:delete') && <button className="btn btn-danger btn-sm" onClick={() => window.confirm('Delete this role?') && a.run(async () => { await del(`roles/${r.id}`); await reload(); })}>Delete</button>}</span>} />}
    <Dialog title="Role" open={Boolean(edit)} onClose={() => setEdit(null)}>{edit && <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); const permissions = new FormData(f).getAll('permissions'); void a.run(async () => { if (edit === 'new') await post('roles', { name: v.name, displayName: v.displayName, permissions }); else await put(`roles/${edit.id}`, { displayName: v.displayName, permissions }); setEdit(null); await reload(); }, 'Saved'); }}><Feedback action={a} />{edit === 'new' && <TextField name="name" label="Short name" hint="Lowercase letters and underscores" pattern="[a-z][a-z0-9_]{2,39}" required />}<TextField name="displayName" label="Name" defaultValue={edit.displayName} required /><PermissionPicker has={edit.permissions ?? []} /><button className="btn btn-primary" disabled={a.busy}>Save</button></form>}</Dialog></>;
}
export function ApiKeys() {
  const { data, reload } = useApi('api-keys');
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const a = useAction();
  return <><H1 side={<button className="btn btn-primary" onClick={() => setOpen(true)}>Create key</button>}>API keys</H1><Feedback action={a} />{key && <Notice kind="ok">Copy this now, it is shown only once: <code className="break-all">{key}</code></Notice>}{data?.items.length ? <Table caption="API keys" rows={data.items} columns={[{ key: 'name', label: 'Name' }, { key: 'keyPrefix', label: 'Starts with' }, { key: 'permissions', label: 'Can' }, { key: 'expiresAt', label: 'Expires' }, { key: 'lastUsedAt', label: 'Last used' }]} actions={(k) => <button className="btn btn-danger btn-sm" onClick={() => window.confirm('Revoke this key?') && a.run(async () => { await del(`api-keys/${k.id}`); await reload(); })}>Revoke</button>} /> : <Empty>No keys.</Empty>}
    <Dialog title="Create API key" open={open} onClose={() => setOpen(false)}><form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); void a.run(async () => { setKey((await post('api-keys', { name: v.name, permissions: new FormData(f).getAll('permissions'), expiresInDays: Number(v.days) })).key); setOpen(false); await reload(); }); }}><Feedback action={a} /><TextField name="name" label="Name" required /><TextField name="days" type="number" min={1} max={365} defaultValue="90" label="Valid for (days)" required /><PermissionPicker has={[]} /><button className="btn btn-primary" disabled={a.busy}>Create</button></form></Dialog></>;
}
export function Modules() {
  const { can } = useSession();
  const { data, reload } = useApi('feature-flags');
  const a = useAction();
  return <><H1>Modules</H1><Feedback action={a} /><ul className="grid gap-3">{data?.items.map((f: any) => <li key={f.key} className="card flex items-center justify-between"><span>{f.name}</span><button className="btn btn-outline" role="switch" aria-checked={f.isEnabled} aria-label={f.name} disabled={!can('feature_flags:update') || a.busy} onClick={() => a.run(async () => { await put('feature-flags', { key: f.key, isEnabled: !f.isEnabled, rolloutPercentage: 100 }); await reload(); })}>{f.isEnabled ? 'On' : 'Off'}</button></li>)}</ul></>;
}
export function Settings() {
  const { data, reload } = useApi('tenant/settings');
  const a = useAction();
  const { can } = useSession();
  if (!data) return <Loading />;
  const s = data.settings ?? {};
  const KEYS = ['tagline', 'about', 'contactEmail', 'contactPhone', 'contactAddress', 'facebook', 'instagram', 'youtube', 'linkedin', 'primaryColor'];
  return <><H1>Website</H1><form className="max-w-xl" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); void a.run(async () => { const impact = (v.impact ?? '').split('\n').filter(Boolean).map((l) => { const [value, label, source] = l.split('|').map((x) => x.trim()); return { value, label, source }; }); await put('tenant/settings', { displayName: v.displayName, supportedLocales: new FormData(f).getAll('supportedLocales'), settings: { ...Object.fromEntries(KEYS.filter((k) => v[k]).map((k) => [k, v[k]])), impact } }); await reload(); }, 'Saved'); }}>
    <Feedback action={a} /><TextField name="displayName" label="Public name" defaultValue={data.displayName ?? data.name} required /><TextField name="tagline" label="Headline" defaultValue={s.tagline} maxLength={200} /><TextArea name="about" label="About" defaultValue={s.about} /><TextField name="primaryColor" type="color" label="Brand colour" defaultValue={s.primaryColor ?? '#1f6b45'} />
    <TextArea name="impact" label="Impact figures" hint="One per line: value | label | source. A source is required, because these are public claims." defaultValue={(s.impact ?? []).map((i: any) => `${i.value} | ${i.label} | ${i.source}`).join('\n')} />
    <TextField name="contactEmail" type="email" label="Contact email" defaultValue={s.contactEmail} /><TextField name="contactPhone" label="Contact phone" defaultValue={s.contactPhone} /><TextArea name="contactAddress" label="Address" rows={2} defaultValue={s.contactAddress} />{['facebook', 'instagram', 'youtube', 'linkedin'].map((k) => <TextField key={k} name={k} type="url" label={`${k[0].toUpperCase()}${k.slice(1)} link`} defaultValue={s[k]} />)}
    <fieldset className="mb-4"><legend className="font-semibold">Languages on your site</legend><div className="flex flex-wrap gap-3">{['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as', 'ur'].map((l) => <label key={l} className="flex items-center gap-1"><input type="checkbox" name="supportedLocales" value={l} defaultChecked={data.supportedLocales.includes(l)} />{l}</label>)}</div></fieldset>
    {can('settings:update') && <button className="btn btn-primary" disabled={a.busy}>Save</button>}</form></>;
}
export function Compliance() {
  const { can } = useSession();
  const { data, reload } = useApi('compliance');
  const acc = useApi(can('payment_accounts:read') ? 'compliance/payment-accounts' : null);
  const a = useAction();
  const b = useAction();
  if (!data) return <Loading />;
  const T: [string, string, string?][] = [['legalName', 'Legal name'], ['registrationNo', 'Registration number'], ['pan', 'PAN of the NGO'], ['address', 'Registered address'], ['reg80G', '80G registration number'], ['reg80GValidFrom', '80G valid from', 'date'], ['reg80GValidUntil', '80G valid until', 'date'], ['reg12A', '12A registration number'], ['csr1No', 'CSR-1 number'], ['fcraNo', 'FCRA number'], ['fcraValidUntil', 'FCRA valid until', 'date'], ['signatoryName', 'Signatory name'], ['signatoryTitle', 'Signatory title']];
  return <><H1>Legal and payments</H1>
    <form className="max-w-xl" key={data.updatedAt} onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(async () => { await put('compliance', Object.fromEntries(T.map(([k, , t]) => [k, k === 'address' ? (v.address ? { line: v.address } : null) : k === 'pan' ? v.pan?.toUpperCase() ?? null : t === 'date' && v[k] ? `${v[k]}T00:00:00+05:30` : v[k] ?? (k === 'legalName' ? undefined : null)]))); await reload(); }, 'Saved'); }}><Feedback action={a} />
      {data.fcraNo && <Notice kind={data.fcraVerifiedAt ? 'ok' : 'info'}>{data.fcraVerifiedAt ? 'FCRA verified by the platform.' : 'FCRA is not verified yet, so foreign donations are refused.'}</Notice>}
      {T.map(([k, l, t]) => <TextField key={k} name={k} label={l} type={t ?? 'text'} required={k === 'legalName'} defaultValue={k === 'address' ? Object.values(data.address ?? {}).join(', ') : t === 'date' ? local(data[k]).slice(0, 10) : data[k] ?? ''} />)}{can('compliance:update') && <button className="btn btn-primary" disabled={a.busy}>Save</button>}</form>
    {acc.data && <section className="mt-8 max-w-xl"><h2 className="mb-2 text-lg font-semibold">Payment gateway</h2><ul className="mb-3">{acc.data.items.map((x: any) => <li key={x.id}>{x.provider} ({x.fund.toLowerCase()}): {x.keyId} {x.isActive ? 'on' : 'off'}</li>)}</ul><p className="field-hint mb-3">Webhook address to enter in Razorpay: <code className="break-all">/api{acc.data.webhookPath.replace('/api/v1', '')}</code> on this site. Turn on payment, refund and subscription events.</p>
      {can('payment_accounts:update') && <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); void b.run(async () => { await put('compliance/payment-accounts', { provider: v.provider, fund: v.fund, keyId: v.keyId, keySecret: v.keySecret, webhookSecret: v.webhookSecret, isActive: v.isActive === 'on' }); f.reset(); await acc.reload(); }, 'Saved'); }}><Feedback action={b} /><Field label="Gateway">{(p) => <select {...p} name="provider"><option value="RAZORPAY">Razorpay</option>{process.env.NODE_ENV !== 'production' && <option value="MOCK">Test gateway</option>}</select>}</Field><Field label="Account for">{(p) => <select {...p} name="fund"><option value="DOMESTIC">Donations from Indian citizens</option><option value="FCRA">Foreign donations (FCRA account)</option></select>}</Field><TextField name="keyId" label="Key ID" required autoComplete="off" /><TextField name="keySecret" type="password" label="Key secret" required autoComplete="new-password" /><TextField name="webhookSecret" type="password" label="Webhook secret" required autoComplete="new-password" /><Check name="isActive" label="Use this account" defaultChecked /><button className="btn btn-primary" disabled={b.busy}>Save gateway</button></form>}</section>}</>;
}
export function Roster({ id }: { id: string }) {
  const { data, reload } = useApi(`volunteering/shifts/${id}/roster`);
  const a = useAction();
  const go = (x: any, step: string) => a.run(async () => { await post(`volunteering/assignments/${x.id}/${step}`); await reload(); });
  return <><H1>Roster</H1><Feedback action={a} />{data?.items.length ? <Table caption="Roster" rows={data.items} columns={[{ key: 'n', label: 'Name', render: (x) => `${x.volunteer.firstName} ${x.volunteer.lastName}` }, { key: 'p', label: 'Phone', render: (x) => x.volunteer.phone ?? '-' }, { key: 'status', label: 'Status' }, { key: 'hoursCredited', label: 'Hours' }]} actions={(x) => !x.checkInTime && ['REGISTERED', 'CONFIRMED'].includes(x.status) ? <button className="btn btn-outline btn-sm" onClick={() => go(x, 'check-in')}>Check in</button> : x.checkInTime && !x.checkOutTime ? <button className="btn btn-primary btn-sm" onClick={() => go(x, 'check-out')}>Check out</button> : null} /> : <Empty>Nobody has signed up yet.</Empty>}</>;
}
export function EventDesk({ id }: { id: string }) {
  const { data, reload } = useApi(`event-desk/${id}/registrations`);
  const a = useAction();
  const [ok, setOk] = useState('');
  return <><H1>Event check-in</H1><form className="mb-4 flex max-w-md items-end gap-3" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = values(f); setOk(''); void a.run(async () => { setOk((await post(`event-desk/${id}/check-in`, v)).name); f.reset(); await reload(); }); }}><TextField name="ticketCode" label="Ticket code" required autoFocus /><button className="btn btn-primary mb-4" disabled={a.busy}>Check in</button></form><Feedback action={a} />{ok && <Notice kind="ok">Welcome, {ok}</Notice>}{data?.items.length ? <Table caption="Registrations" rows={data.items} columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'checkedInAt', label: 'Checked in' }]} /> : <Empty>No registrations yet.</Empty>}</>;
}
export function Marking({ id }: { id: string }) {
  const { data, reload } = useApi(`learning/assignments/${id}/submissions`);
  const a = useAction();
  return <><H1>Mark work</H1><Feedback action={a} />{!data?.items.length && <Empty>No work submitted yet.</Empty>}{data?.items.map((s: any) => <div key={s.id} className="card mb-4"><h2 className="font-semibold">{s.student.fullName} <Badge value={s.status} /> {s.isLate && <span className="badge badge-bad">late</span>}</h2><p className="my-2 whitespace-pre-wrap">{s.text}</p>{s.fileId && <button className="btn btn-outline btn-sm" onClick={() => a.run(async () => window.location.assign((await api(`files/${s.fileId}/download`)).url))}>Open file</button>}<form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const v = values(e.currentTarget); void a.run(async () => { await put(`learning/submissions/${s.id}/grade`, { score: Number(v.score), feedback: v.feedback }); await reload(); }, 'Saved'); }}><TextField name="score" type="number" min={0} label="Marks" defaultValue={s.score ?? ''} required /><TextField name="feedback" label="Comment" defaultValue={s.feedback ?? ''} /><button className="btn btn-primary mb-4" disabled={a.busy}>Save</button></form></div>)}</>;
}
export function Gradebook({ id }: { id: string }) {
  const { data } = useApi(`learning/courses/${id}/gradebook`);
  if (!data) return <Loading />;
  return <><H1>Gradebook</H1>{data.items.length ? <Table caption="Gradebook" rows={data.items.map((x: any) => ({ ...x, id: x.studentId }))} columns={[{ key: 'name', label: 'Student' }, { key: 'lessonsDone', label: 'Lessons' }, { key: 'attended', label: `Classes (of ${data.classes})` }, ...data.assignments.map((as: any) => ({ key: as.id, label: `${as.title} (/${as.maxScore})`, render: (r: any) => { const s = r.submissions.find((z: any) => z.assignmentId === as.id); return s ? (s.score ?? 'Submitted') : '-'; } }))]} /> : <Empty>No students yet.</Empty>}</>;
}
export function StaffPage({ path }: { path: string[] }) {
  const [a, id] = path;
  const special: Record<string, () => ReactNode> = { donations: Donations, finance: Finance, monitoring: Monitoring, members: Members, roles: Roles, 'api-keys': ApiKeys, modules: Modules, settings: Settings, compliance: Compliance };
  if (id) { const V = ({ roster: Roster, 'event-desk': EventDesk, marking: Marking, gradebook: Gradebook } as Record<string, (p: { id: string }) => ReactNode>)[a]; if (V) return <V id={id} />; }
  const S = special[a];
  if (S && !id) return <S />;
  if (Object.hasOwn(STAFF, a) && !id) return <Resource key={a} name={a} />;
  return <Notice kind="error">Page not found</Notice>;
}
