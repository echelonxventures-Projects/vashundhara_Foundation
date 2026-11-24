'use client';
import { builtInFields, checkDefinition, choiceable, CUSTOM_TYPES, CustomField, CustomTable, Definition, emptyDefinition, EntityStructure, entityTitle, EXTENDABLE, FormDef, keyFrom, Layout, LAYOUT_LOCKED, LOCKED_FIELDS, RECORDS, REF_LABELS, RULE_OPS, RuleAction, RuleDef, ruleFields, TABLE_ACTIONS } from '@vashundhara-foundation/shared';
import { ReactNode, useEffect, useState } from 'react';
import { api, del, post, put, saveText } from './api';
import { Dialog, Empty, Feedback, Field, Loading, Notice, Table, useAction, useApi } from './components';

type Role = { name: string; displayName: string };
const TYPE_NAMES: Record<string, string> = { text: 'Short text', textarea: 'Long text', number: 'Number', money: 'Amount in rupees', date: 'Date', datetime: 'Date and time', bool: 'Yes or no', select: 'Choose one', multi: 'Choose several', email: 'Email', phone: 'Phone', url: 'Web link', file: 'File', ref: 'Link to another record' };
const OP_NAMES: Record<string, string> = { eq: 'is', ne: 'is not', gt: 'is more than', lt: 'is less than', contains: 'contains', filled: 'is filled in', empty: 'is empty', changed: 'has changed' };
const Tick = ({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => <label className="check"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span>{label}{hint && <span className="field-hint block">{hint}</span>}</span></label>;
const Text = ({ label, value, onChange, hint, required, multi, type, max }: { label: string; value: string; onChange: (v: string) => void; hint?: string; required?: boolean; multi?: boolean; type?: string; max?: number }) => <Field label={label} hint={hint} required={required}>{(p) => multi ? <textarea {...p} rows={3} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} /> : <input {...p} type={type ?? 'text'} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />}</Field>;
const Pick = ({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; hint?: string }) => <Field label={label} hint={hint}>{(p) => <select {...p} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Field>;
const move = <T,>(xs: T[], i: number, by: number): T[] => { const j = i + by; if (j < 0 || j >= xs.length) return xs; const out = [...xs]; [out[i], out[j]] = [out[j], out[i]]; return out; };
const freeKey = (label: string, taken: string[]) => { const base = keyFrom(label); let k = base; for (let n = 2; taken.includes(k); n++) k = `${base.slice(0, 36)}_${n}`; return k; };
const Small = ({ children, onClick, danger, label, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; label?: string; disabled?: boolean }) => <button type="button" disabled={disabled} className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-outline'}`} aria-label={label} onClick={onClick}>{children}</button>;
const day = (v: string) => new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const targets = (d: Definition): [string, string][] => [...d.tables.filter((t) => !t.archived).map((t): [string, string] => [`x:${t.key}`, `${t.title} (own table)`]), ...Object.keys(REF_LABELS).map((e): [string, string] => [e, entityTitle(e)])];

// ---------- one field ----------
function FieldForm({ d, field, taken, live, onDone }: { d: Definition; field: CustomField | null; taken: string[]; live: boolean; onDone: (f: CustomField) => void }) {
  const [f, setF] = useState<CustomField>(field ?? { key: '', label: '', type: 'text' });
  const [err, setErr] = useState('');
  const set = (x: Partial<CustomField>) => setF((o) => ({ ...o, ...x }));
  const choices = f.choices ?? [];
  const listy = f.type === 'select' || f.type === 'multi';
  const numeric = f.type === 'number' || f.type === 'money';
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!f.label.trim()) { setErr('Give the field a name'); return; }
      const out: CustomField = { ...f, label: f.label.trim(), key: f.key || freeKey(f.label, taken) };
      if (!listy) delete out.choices; else out.choices = choices.filter((c) => c.label.trim()).map((c) => ({ ...c, label: c.label.trim() }));
      if (out.type !== 'ref') delete out.ref; else out.ref ??= targets(d)[0]?.[0];
      if (['bool', 'multi', 'file', 'textarea'].includes(out.type)) delete out.unique;
      for (const k of Object.keys(out) as (keyof CustomField)[]) if (out[k] === undefined || out[k] === '' || out[k] === false) delete out[k];
      onDone(out);
    }}>
      {err && <Notice kind="error">{err}</Notice>}
      <Text label="Name" value={f.label} onChange={(label) => set({ label })} required max={80} />
      <Pick label="Kind" value={f.type} onChange={(type) => set({ type: type as CustomField['type'] })} options={CUSTOM_TYPES.map((t) => [t, TYPE_NAMES[t]])} hint={live ? 'Existing values are checked before a change of kind is published.' : undefined} />
      {listy && <fieldset className="mb-4"><legend className="font-semibold">Choices</legend>{choices.map((c, i) => <div key={c.value} className="mb-2 flex flex-wrap items-center gap-2"><input className="input max-w-xs" aria-label={`Choice ${i + 1}`} value={c.label} maxLength={80} onChange={(e) => set({ choices: choices.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)) })} /><Small label={`Move choice ${i + 1} up`} onClick={() => set({ choices: move(choices, i, -1) })}>↑</Small>{c.archived ? <Small onClick={() => set({ choices: choices.map((x, n) => (n === i ? { ...x, archived: undefined } : x)) })}>Offer again</Small> : <Small danger label={`Remove choice ${c.label || i + 1}`} onClick={() => set({ choices: choices.filter((_, n) => n !== i) })}>Remove</Small>}</div>)}<Small onClick={() => set({ choices: [...choices, { value: `c${Date.now().toString(36)}${choices.length}`, label: '' }] })}>Add choice</Small></fieldset>}
      {f.type === 'ref' && <Pick label="Links to" value={f.ref ?? targets(d)[0]?.[0] ?? ''} onChange={(ref) => set({ ref })} options={targets(d)} />}
      <Text label="Help text" value={f.hint ?? ''} onChange={(hint) => set({ hint })} max={200} />
      {(numeric || f.type === 'text' || f.type === 'textarea') && <div className="grid gap-3 sm:grid-cols-2"><Text type="number" label={numeric ? 'Smallest allowed' : 'Shortest allowed'} value={f.min === undefined ? '' : String(f.min)} onChange={(v) => set({ min: v === '' ? undefined : Number(v) })} /><Text type="number" label={numeric ? 'Largest allowed' : 'Longest allowed'} value={f.max === undefined ? '' : String(f.max)} onChange={(v) => set({ max: v === '' ? undefined : Number(v) })} /></div>}
      {f.type !== 'bool' && <Tick label="Required on new records" checked={Boolean(f.required)} onChange={(required) => set({ required })} />}
      {!['bool', 'multi', 'file', 'textarea'].includes(f.type) && <Tick label="No two records may share a value" checked={Boolean(f.unique)} onChange={(unique) => set({ unique })} />}
      <Tick label="Personal information" hint="Kept out of the audit log, included when a person asks for their data, removed when they ask for deletion" checked={Boolean(f.personal)} onChange={(personal) => set({ personal })} />
      <Tick label="Show in the list" checked={Boolean(f.list)} onChange={(list) => set({ list })} />
      {['text', 'textarea', 'email', 'phone'].includes(f.type) && <Tick label="Include in search" checked={Boolean(f.search)} onChange={(search) => set({ search })} />}
      {['select', 'multi', 'bool', 'date', 'number', 'text'].includes(f.type) && <Tick label="Offer as a filter" checked={Boolean(f.filter)} onChange={(filter) => set({ filter })} />}
      <p className="field-hint mb-3">Key: {f.key || (f.label ? freeKey(f.label, taken) : '-')}. It never changes, so renaming is safe.</p>
      <button className="btn btn-primary">Done</button>
    </form>
  );
}
function Fields({ d, fields, live, onChange, caption }: { d: Definition; fields: CustomField[]; live: string[]; onChange: (f: CustomField[]) => void; caption: string }) {
  const [edit, setEdit] = useState<CustomField | 'new' | null>(null);
  const put1 = (f: CustomField) => onChange(edit === 'new' ? [...fields, f] : fields.map((x) => (x.key === f.key ? f : x)));
  const flags = (f: CustomField) => [f.required && 'required', f.unique && 'unique', f.personal && 'personal', f.list && 'in list', f.search && 'search', f.filter && 'filter', f.archived && 'archived'].filter(Boolean).join(', ');
  return (
    <section className="mb-6"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">{caption}</h3><Small onClick={() => setEdit('new')}>Add field</Small></div>
      {fields.length ? <Table caption={caption} rows={fields.map((f, i) => ({ ...f, id: f.key, i }))} columns={[{ key: 'label', label: 'Name' }, { key: 'type', label: 'Kind', render: (f) => TYPE_NAMES[f.type] }, { key: 'flags', label: 'Settings', render: (f) => flags(f) || '-' }]}
        actions={(f) => <span className="inline-flex gap-1"><Small label={`Move ${f.label} up`} onClick={() => onChange(move(fields, f.i, -1))}>↑</Small><Small label={`Move ${f.label} down`} onClick={() => onChange(move(fields, f.i, 1))}>↓</Small><Small label={`Edit ${f.label}`} onClick={() => setEdit(fields[f.i])}>Edit</Small>{f.archived ? <Small label={`Restore ${f.label}`} onClick={() => onChange(fields.map((x) => (x.key === f.key ? { ...x, archived: undefined } : x)))}>Restore</Small> : live.includes(f.key) ? <Small danger label={`Archive ${f.label}`} onClick={() => onChange(fields.map((x) => (x.key === f.key ? { ...x, archived: true } : x)))}>Archive</Small> : <Small danger label={`Remove ${f.label}`} onClick={() => onChange(fields.filter((x) => x.key !== f.key))}>Remove</Small>}</span>} /> : <Empty>No extra fields yet.</Empty>}
      <Dialog title={edit === 'new' ? 'Add field' : 'Edit field'} open={edit !== null} onClose={() => setEdit(null)}>{edit !== null && <FieldForm d={d} field={edit === 'new' ? null : edit} taken={fields.map((f) => f.key)} live={edit !== 'new' && live.includes(edit.key)} onDone={(f) => { put1(f); setEdit(null); }} />}</Dialog>
    </section>
  );
}

// ---------- built-in screens ----------
function LayoutForm({ entity, s, onChange }: { entity: string; s: EntityStructure; onChange: (l: Layout) => void }) {
  const l = s.layout ?? {};
  const set = (x: Partial<Layout>) => onChange({ ...l, ...x });
  const built = builtInFields(entity);
  const all = [...built.map((f) => ({ key: f.key, label: f.label })), ...s.fields.filter((f) => !f.archived).map((f) => ({ key: `custom.${f.key}`, label: f.label }))];
  const order = [...(l.order ?? []).filter((k) => all.some((f) => f.key === k)), ...all.map((f) => f.key).filter((k) => !l.order?.includes(k))];
  const flip = (list: string[] | undefined, k: string, on: boolean) => (on ? [...(list ?? []), k] : (list ?? []).filter((x) => x !== k));
  const pickable = choiceable(entity);
  const columns = l.columns ?? [...RECORDS[entity].columns.map(([k]) => k), ...s.fields.filter((f) => f.list && !f.archived).map((f) => `custom.${f.key}`)];
  const columnOptions: [string, string][] = [...RECORDS[entity].columns, ...s.fields.filter((f) => !f.archived).map((f): [string, string] => [`custom.${f.key}`, f.label])];
  return (
    <section><h3 className="mb-2 text-lg font-semibold">Screen layout</h3>
      <Text label="Screen name" value={l.title ?? ''} hint={`Normally "${RECORDS[entity].title}"`} onChange={(v) => set({ title: v || undefined })} max={80} />
      <Table caption="Fields on the form" rows={order.map((k, i) => ({ id: k, i, f: built.find((f) => f.key === k), label: all.find((f) => f.key === k)!.label }))} columns={[
        { key: 'label', label: 'Field', render: (r) => r.label },
        { key: 'n', label: 'Shown as', render: (r) => (!r.f ? 'Own field' : LOCKED_FIELDS.has(r.id) ? 'Locked' : <input className="input" aria-label={`Name for ${r.label}`} placeholder={r.label} value={l.labels?.[r.id] ?? ''} maxLength={80} onChange={(e) => { const labels: Record<string, string> = { ...l.labels, [r.id]: e.target.value }; if (!e.target.value) delete labels[r.id]; set({ labels }); }} />) },
        { key: 'h', label: 'Hide', render: (r) => (r.f && !r.f.required && !LOCKED_FIELDS.has(r.id) ? <input type="checkbox" aria-label={`Hide ${r.label}`} checked={Boolean(l.hidden?.includes(r.id))} onChange={(e) => set({ hidden: flip(l.hidden, r.id, e.target.checked) })} /> : '-') },
        { key: 'r', label: 'Required', render: (r) => (r.f && !r.f.required && !LOCKED_FIELDS.has(r.id) && !['bool', 'tags', 'multi'].includes(r.f.type ?? '') ? <input type="checkbox" aria-label={`Require ${r.label}`} checked={Boolean(l.required?.includes(r.id))} onChange={(e) => set({ required: flip(l.required, r.id, e.target.checked) })} /> : r.f?.required ? 'Always' : '-') }
      ]} actions={(r) => <span className="inline-flex gap-1"><Small label={`Move ${r.label} up`} onClick={() => set({ order: move(order, r.i, -1) })}>↑</Small><Small label={`Move ${r.label} down`} onClick={() => set({ order: move(order, r.i, 1) })}>↓</Small></span>} />
      <fieldset className="my-4"><legend className="font-semibold">Columns in the list</legend><div className="flex flex-wrap gap-3">{columnOptions.map(([k, t]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={columns.includes(k)} onChange={(e) => set({ columns: columnOptions.map(([x]) => x).filter((x) => (x === k ? e.target.checked : columns.includes(x))) })} />{t}</label>)}</div></fieldset>
      {pickable.map((f) => <Text key={f.key} multi label={`Choices for ${l.labels?.[f.key] ?? f.label}`} hint="One per line. Leave empty for free text." value={(l.choices?.[f.key] ?? []).join('\n')} onChange={(v) => { const cs = v.split('\n'); const choices = { ...l.choices, [f.key]: cs }; if (!v) delete choices[f.key]; set({ choices }); }} />)}
      <Small danger onClick={() => onChange({})}>Back to the normal layout</Small>
    </section>
  );
}

// ---------- tables, forms, rules ----------
function TableForm({ d, t, roles, live, onChange }: { d: Definition; t: CustomTable; roles: Role[]; live?: CustomTable; onChange: (t: CustomTable) => void }) {
  const staff = roles.filter((r) => !['tenant_admin', 'donor', 'beneficiary', 'student', 'csr_partner', 'volunteer', 'auditor'].includes(r.name));
  const has = (a: (typeof TABLE_ACTIONS)[number], r: string) => (t.access?.[a] ?? (a === 'read' ? ['manager'] : t.access?.read ?? ['manager'])).includes(r);
  return <>
    <div className="grid gap-3 sm:grid-cols-2"><Text label="Table name" value={t.title} onChange={(title) => onChange({ ...t, title })} required max={80} /><Text label="Menu section" value={t.group ?? ''} hint="For example Programmes. Empty means Own tables." onChange={(group) => onChange({ ...t, group: group || undefined })} max={40} /></div>
    <Fields d={d} caption="Fields" fields={t.fields} live={live?.fields.map((f) => f.key) ?? []} onChange={(fields) => onChange({ ...t, fields })} />
    <h3 className="mb-1 text-lg font-semibold">Who may use it</h3><p className="field-hint mb-2">The NGO Administrator always may. The role must also have the matching records permission.</p>
    <Table caption="Who may use this table" rows={staff.map((r) => ({ ...r, id: r.name }))} columns={[{ key: 'displayName', label: 'Role' }, ...TABLE_ACTIONS.map((a) => ({ key: a, label: { read: 'See', create: 'Add', update: 'Edit', delete: 'Delete' }[a] as string, render: (r: any) => <input type="checkbox" aria-label={`${r.displayName}: ${a}`} checked={has(a, r.name)} onChange={(e) => { const access = Object.fromEntries(TABLE_ACTIONS.map((x) => [x, staff.map((y) => y.name).filter((y) => (x === a && y === r.name ? e.target.checked : has(x, y)))])); onChange({ ...t, access }); }} /> }))]} />
  </>;
}
function FormForm({ d, f, onChange }: { d: Definition; f: FormDef; onChange: (f: FormDef) => void }) {
  const tables = d.tables.filter((t) => !t.archived);
  const fields = (tables.find((t) => t.key === f.table)?.fields ?? []).filter((x) => !x.archived && x.type !== 'file' && x.type !== 'ref');
  const on = (k: string) => f.fields.find((x) => x.key === k);
  return <>
    <Text label="Form title" value={f.title} onChange={(title) => onChange({ ...f, title })} required max={80} /><Text multi label="Introduction" value={f.intro ?? ''} onChange={(intro) => onChange({ ...f, intro: intro || undefined })} max={2000} /><Text label="Message after sending" value={f.success ?? ''} onChange={(success) => onChange({ ...f, success: success || undefined })} max={500} />
    <Pick label="Saves into" value={f.table} onChange={(table) => onChange({ ...f, table, fields: [] })} options={[['', 'Choose a table'], ...tables.map((t): [string, string] => [t.key, t.title])]} />
    <Pick label="Who may send it" value={f.access} onChange={(access) => onChange({ ...f, access: access as FormDef['access'] })} options={[['PUBLIC', 'Anyone'], ['MEMBERS', 'Signed-in people']]} />
    <fieldset className="mb-4"><legend className="font-semibold">Questions</legend>{!fields.length && <p className="field-hint">Choose a table that has fields.</p>}{fields.map((x) => <div key={x.key} className="flex flex-wrap gap-4"><Tick label={x.label} checked={Boolean(on(x.key))} onChange={(v) => onChange({ ...f, fields: fields.filter((y) => (y.key === x.key ? v : on(y.key))).map((y) => on(y.key) ?? { key: y.key }) })} />{on(x.key) && (x.required ? <span className="field-hint">Always required</span> : <Tick label="Required" checked={Boolean(on(x.key)!.required)} onChange={(v) => onChange({ ...f, fields: f.fields.map((y) => (y.key === x.key ? { key: y.key, ...(v ? { required: true } : {}) } : y)) })} />)}</div>)}</fieldset>
    <p className="field-hint mb-3">Forms cannot upload files or show records. When a form asks for personal information, the sender must agree first, and the agreement is stored.</p>
    <Tick label="Active" checked={f.active} onChange={(active) => onChange({ ...f, active })} />
    <p className="field-hint">Address once published: /forms/{f.key}</p>
  </>;
}
function RuleForm({ d, r, roles, onChange }: { d: Definition; r: RuleDef; roles: Role[]; onChange: (r: RuleDef) => void }) {
  const fields = ruleFields(d, r.entity).map((x): [string, string] => [x.key, x.label]);
  const cond = (i: number, x: object) => onChange({ ...r, conditions: r.conditions.map((c, n) => (n === i ? { ...c, ...x } : c)) });
  const act = (i: number, a: RuleAction) => onChange({ ...r, actions: r.actions.map((x, n) => (n === i ? a : x)) });
  const fresh = (type: string): RuleAction => (type === 'NOTIFY_ROLE' ? { type, role: 'tenant_admin', channel: 'IN_APP', subject: '', body: '' } : type === 'EMAIL_FIELD' ? { type, field: '', subject: '', body: '' } : type === 'TASK' ? { type, subject: '', dueInDays: 1 } : { type: 'WEBHOOK' });
  const choices = (k: string) => { const t = r.entity.startsWith('x:') ? d.tables.find((x) => `x:${x.key}` === r.entity)?.fields.find((x) => x.key === k) : d.entities[r.entity]?.fields.find((x) => `custom.${x.key}` === k); return t?.choices?.filter((c) => !c.archived) ?? RECORDS[r.entity]?.fields.find((x) => x.key === k)?.options?.map((o) => ({ value: o, label: o.toLowerCase().replace(/_/g, ' ') })); };
  return <>
    <Text label="Rule name" value={r.name} onChange={(name) => onChange({ ...r, name })} required max={80} />
    <div className="grid gap-3 sm:grid-cols-2"><Pick label="Watches" value={r.entity} onChange={(entity) => onChange({ ...r, entity, conditions: [] })} options={[['', 'Choose records'], ...targets(d), ['aid', entityTitle('aid')], ['readings', entityTitle('readings')], ['utilisation', entityTitle('utilisation')]]} /><Pick label="When a record is" value={r.on} onChange={(on) => onChange({ ...r, on: on as RuleDef['on'] })} options={[['CREATED', 'added'], ['UPDATED', 'changed'], ['SAVED', 'added or changed']]} /></div>
    <fieldset className="mb-4"><legend className="font-semibold">Only if all of these are true</legend>{r.conditions.map((c, i) => <div key={i} className="mb-2 flex flex-wrap gap-2"><select className="input max-w-[200px]" aria-label={`Condition ${i + 1} field`} value={c.field} onChange={(e) => cond(i, { field: e.target.value, value: undefined })}><option value="">Choose a field</option>{fields.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><select className="input max-w-[160px]" aria-label={`Condition ${i + 1} test`} value={c.op} onChange={(e) => cond(i, { op: e.target.value })}>{RULE_OPS.map((o) => <option key={o} value={o}>{OP_NAMES[o]}</option>)}</select>{!['filled', 'empty', 'changed'].includes(c.op) && (choices(c.field) ? <select className="input max-w-[200px]" aria-label={`Condition ${i + 1} value`} value={c.value ?? ''} onChange={(e) => cond(i, { value: e.target.value })}><option value="" />{choices(c.field)!.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select> : <input className="input max-w-[200px]" aria-label={`Condition ${i + 1} value`} value={c.value ?? ''} maxLength={200} onChange={(e) => cond(i, { value: e.target.value })} />)}<Small danger label={`Remove condition ${i + 1}`} onClick={() => onChange({ ...r, conditions: r.conditions.filter((_, n) => n !== i) })}>Remove</Small></div>)}<Small onClick={() => onChange({ ...r, conditions: [...r.conditions, { field: '', op: 'eq' }] })}>Add condition</Small></fieldset>
    <fieldset className="mb-4"><legend className="font-semibold">Then</legend>{r.actions.map((a, i) => <div key={i} className="card mb-3">
      <Pick label={`Action ${i + 1}`} value={a.type} onChange={(t) => act(i, fresh(t))} options={[['NOTIFY_ROLE', 'Tell everyone with a role'], ['EMAIL_FIELD', 'Email the address on the record'], ['TASK', 'Create a CRM task'], ['WEBHOOK', 'Call webhooks that listen for saved records']]} />
      {a.type === 'NOTIFY_ROLE' && <><Pick label="Role" value={a.role} onChange={(role) => act(i, { ...a, role })} options={roles.map((x) => [x.name, x.displayName])} /><Pick label="By" value={a.channel} onChange={(c) => act(i, { ...a, channel: c as 'EMAIL' | 'IN_APP' })} options={[['IN_APP', 'Notification'], ['EMAIL', 'Email']]} /></>}
      {a.type === 'EMAIL_FIELD' && <Pick label="Email field" value={a.field} onChange={(field) => act(i, { ...a, field })} options={[['', 'Choose'], ...fields]} hint="The text is sent as written, and each address hears from this rule at most once a day." />}
      {'subject' in a && <Text label="Subject" value={a.subject} onChange={(subject) => act(i, { ...a, subject } as RuleAction)} required max={200} hint={a.type === 'EMAIL_FIELD' || !fields.length ? undefined : `You may use {{${fields[0][0]}}} and other fields: ${fields.slice(0, 8).map(([k]) => k).join(', ')}`} />}
      {'body' in a && <Text multi label="Message" value={a.body} onChange={(body) => act(i, { ...a, body } as RuleAction)} required max={5000} />}
      {a.type === 'TASK' && <Text type="number" label="Due in days" value={String(a.dueInDays)} onChange={(v) => act(i, { ...a, dueInDays: Math.max(0, Math.round(Number(v) || 0)) })} />}
      <Small danger label={`Remove action ${i + 1}`} onClick={() => onChange({ ...r, actions: r.actions.filter((_, n) => n !== i) })}>Remove action</Small></div>)}<Small onClick={() => onChange({ ...r, actions: [...r.actions, fresh('NOTIFY_ROLE')] })}>Add action</Small></fieldset>
    <Tick label="Active" checked={r.active} onChange={(active) => onChange({ ...r, active })} />
  </>;
}

const TABS = [['records', 'Fields and layout'], ['tables', 'Own tables'], ['forms', 'Forms'], ['rules', 'Rules'], ['publish', 'Publish and history']] as const;
/** The whole editor. `base` is "structure" for an NGO, or "platform/structure/ngos/<id>" for Super Admin. */
export function StructureEditor({ base, platform = false, onPublished }: { base: string; platform?: boolean; onPublished?: () => void }) {
  const { data, error, reload } = useApi(`${base}/manage`);
  const [d, setD] = useState<Definition | null>(null);
  const [rev, setRev] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('records');
  const [entity, setEntity] = useState('donors');
  const [sel, setSel] = useState<Record<string, string | null>>({});
  const [adding, setAdding] = useState('');
  const a = useAction();
  useEffect(() => { if (data) { setD(structuredClone(data.draft?.definition ?? data.live?.definition ?? emptyDefinition())); setRev(data.draft?.rev ?? 0); setDirty(false); } }, [data]);
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => e.preventDefault(); window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!data || !d) return <Loading />;
  const live: Definition = data.live?.definition ?? emptyDefinition();
  const edit = (x: Partial<Definition>) => { setD({ ...d, ...x }); setDirty(true); };
  const clean = (x: Definition): Definition => ({ ...x, entities: Object.fromEntries(Object.entries(x.entities).map(([e, s]) => { const l = s.layout && { ...s.layout, choices: Object.fromEntries(Object.entries(s.layout.choices ?? {}).map(([k, cs]) => [k, cs.map((c) => c.trim()).filter(Boolean)])) }; return [e, { fields: s.fields, ...(l && Object.values(l).some((v) => (typeof v === 'object' ? Object.keys(v).length : v)) ? { layout: l } : {}) }]; }).filter(([, s]) => (s as EntityStructure).fields.length || (s as EntityStructure).layout)) });
  const save = async () => { const r = await put(`${base}/manage/draft`, { definition: clean(d), rev }); setRev(r.rev); setD(r.definition); setDirty(false); return r; };
  const s: EntityStructure = d.entities[entity] ?? { fields: [] };
  const setS = (x: EntityStructure) => edit({ entities: { ...d.entities, [entity]: x } });
  const list = <T extends { key: string }>(name: 'tables' | 'forms' | 'rules', items: T[], title: (x: T) => string, make: (key: string, name: string) => T, form: (x: T, set: (x: T) => void) => ReactNode, what: string) => {
    const x = items.find((i) => i.key === sel[name]);
    const set = (y: T) => edit({ [name]: items.map((i) => (i.key === y.key ? y : i)) } as Partial<Definition>);
    const isLive = (k: string) => name === 'tables' && live.tables.some((t) => t.key === k);
    return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div><ul className="mb-3 grid gap-1">{items.map((i) => <li key={i.key}><button type="button" aria-pressed={sel[name] === i.key} className={`btn btn-sm w-full ${sel[name] === i.key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSel({ ...sel, [name]: i.key })}>{title(i) || 'No name yet'}{(i as { archived?: boolean }).archived ? ' (archived)' : ''}</button></li>)}</ul><form className="mt-4" onSubmit={(e) => { e.preventDefault(); const t = adding.trim(); if (!t) return; const n = make(freeKey(t, items.map((i) => i.key)), t); edit({ [name]: [...items, n] } as Partial<Definition>); setSel({ ...sel, [name]: n.key }); setAdding(''); }}><Text label={`New ${what} name`} value={adding} onChange={setAdding} max={80} required /><button className="btn btn-outline btn-sm">Add {what}</button></form></div>
      <div className="min-w-0">{x ? <>{form(x, set)}<div className="mt-6">{(x as { archived?: boolean }).archived ? <Small onClick={() => set({ ...x, archived: undefined } as T)}>Restore {what}</Small> : <Small danger onClick={() => { if (isLive(x.key)) set({ ...x, archived: true } as T); else { edit({ [name]: items.filter((i) => i.key !== x.key) } as Partial<Definition>); setSel({ ...sel, [name]: null }); } }}>{isLive(x.key) ? `Archive ${what}` : `Remove ${what}`}</Small>}</div></> : <Empty>{items.length ? `Choose a ${what}.` : `No ${what}s yet.`}</Empty>}</div>
    </div>;
  };
  const problems = checkDefinition(clean(d));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Parts of the structure">{TABS.map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTab(k); setAdding(''); }}>{l}</button>)}</div>
      <div className="mb-4 flex flex-wrap items-center gap-3"><button type="button" className="btn btn-primary" disabled={!dirty || a.busy} onClick={() => a.run(save, 'Draft saved. Nothing is live until you publish.')}>Save draft</button><span className="text-muted">{dirty ? 'Unsaved changes' : rev && data.draft?.submittedAt ? 'Waiting for Super Admin' : rev ? 'Draft saved, not live yet' : data.live ? `Live version ${data.live.number}` : 'Nothing published yet'}</span></div>
      <Feedback action={a} />
      {data.draft?.reviewNote && !data.draft.submittedAt && <Notice kind="error">Super Admin sent this draft back: {data.draft.reviewNote}</Notice>}
      {data.draft?.submittedAt && !dirty && <Notice>{platform ? `${data.draft.submittedBy ?? 'Someone'} sent this for review on ${day(data.draft.submittedAt)}.` : `Sent for review on ${day(data.draft.submittedAt)}. Saving a change takes it out of the queue.`}{data.draft.submitNote && <> Note: {data.draft.submitNote}</>}{platform && data.draft.editedBy !== data.draft.submittedBy && <> Last edited by {data.draft.editedBy}.</>}</Notice>}
      {problems.length > 0 && <Notice kind="info"><p>Before publishing:</p><ul className="mt-1 list-disc ps-5">{problems.slice(0, 10).map((p) => <li key={p.where + p.message}>{p.where}: {p.message}</li>)}</ul></Notice>}
      {tab === 'records' && <><Pick label="Records" value={entity} onChange={setEntity} options={EXTENDABLE.map((e) => [e, `${entityTitle(e)}${d.entities[e] ? ' (changed)' : ''}`])} /><Fields key={entity} d={d} caption={`Extra fields on ${entityTitle(entity)}`} fields={s.fields} live={live.entities[entity]?.fields.map((f) => f.key) ?? []} onChange={(fields) => setS({ ...s, fields })} />{LAYOUT_LOCKED.has(entity) ? <Notice>Only extra fields can be added here. Amounts, status and numbers are locked because legal and accounting records depend on them.</Notice> : <LayoutForm entity={entity} s={s} onChange={(layout) => setS({ ...s, layout })} />}</>}
      {tab === 'tables' && list<CustomTable>('tables', d.tables, (t) => t.title, (key, title) => ({ key, title, fields: [] }), (t, set) => <TableForm d={d} t={t} roles={data.roles} live={live.tables.find((x) => x.key === t.key)} onChange={set} />, 'table')}
      {tab === 'forms' && list<FormDef>('forms', d.forms, (f) => f.title, (key, title) => ({ key, title, table: '', access: 'PUBLIC', active: true, fields: [] }), (f, set) => <FormForm d={d} f={f} onChange={set} />, 'form')}
      {tab === 'rules' && list<RuleDef>('rules', d.rules, (r) => r.name, (key, name) => ({ key, name, entity: '', on: 'CREATED', active: true, conditions: [], actions: [] }), (r, set) => <RuleForm d={d} r={r} roles={data.roles} onChange={set} />, 'rule')}
      {tab === 'publish' && <Publish base={base} platform={platform} rev={rev} dirty={dirty} data={data} live={live} run={a} reload={async () => { await reload(); onPublished?.(); }} />}
    </div>
  );
}
function Publish({ base, platform, rev, dirty, data, live, run, reload }: { base: string; platform: boolean; rev: number; dirty: boolean; data: any; live: Definition; run: ReturnType<typeof useAction>; reload: () => Promise<void> }) {
  const pv = useApi(rev && !dirty ? `${base}/manage/preview?rev=${rev}` : null);
  const [note, setNote] = useState('');
  const [purge, setPurge] = useState<{ entity: string; key: string | null; label: string; id: string } | null>(null);
  const [typed, setTyped] = useState('');
  const archived = [...Object.entries(live.entities).flatMap(([e, s]) => s.fields.filter((f) => f.archived).map((f) => ({ entity: e, key: f.key as string | null, label: `${entityTitle(e)} > ${f.label}` }))), ...live.tables.flatMap((t) => [...(t.archived ? [{ entity: `x:${t.key}`, key: null, label: `Table ${t.title}` }] : []), ...t.fields.filter((f) => f.archived).map((f) => ({ entity: `x:${t.key}`, key: f.key as string | null, label: `${t.title} > ${f.label}` }))])].map((x) => ({ ...x, id: `${x.entity}/${x.key}` }));
  const waiting = Boolean(data.draft?.submittedAt);
  const blocked = pv.data?.problems.length > 0 || pv.data?.changes.some((c: any) => c.blocked);
  return <>
    <h2 className="mb-2 text-lg font-semibold">What will change</h2>
    {dirty ? <Notice>Save the draft first to see what it would change.</Notice> : !rev ? <p className="text-muted">There is no draft. Nothing is waiting to be published.</p> : !pv.data ? <Loading /> : <>
      {pv.data.changes.length ? <ul className="mb-4 grid gap-2">{pv.data.changes.map((c: any, i: number) => <li key={i} className="card"><strong>{c.where}</strong>: {c.message}{c.records !== undefined && <span className="text-muted"> ({c.records} records)</span>}{c.blocked && <span className="badge badge-bad ms-2">must be fixed</span>}</li>)}</ul> : <p className="mb-4 text-muted">No differences from the live version.</p>}
      <Text label={data.canPublish ? (waiting ? 'Note for the NGO and the history' : 'Note for the history') : 'Note for Super Admin'} value={note} onChange={setNote} max={300} hint={waiting && platform ? 'To send it back, say what should change.' : undefined} />
      {!data.canPublish && <p className="field-hint mb-3">Super Admin reviews and approves each publish for this organisation.</p>}
      <div className="mb-6 flex flex-wrap gap-2">{data.canPublish ? <button type="button" className="btn btn-primary" disabled={run.busy || blocked} onClick={() => run.run(async () => { await post(`${base}/manage/publish`, { rev, ...(note ? { note } : {}) }); setNote(''); await reload(); }, 'Published. It is live now.')}>{waiting && platform ? 'Approve and publish' : 'Publish'}</button> : waiting ? <button type="button" className="btn btn-outline" disabled={run.busy} onClick={() => run.run(async () => { await del(`${base}/manage/submit`); await reload(); }, 'Taken out of the queue')}>Withdraw</button> : <button type="button" className="btn btn-primary" disabled={run.busy || blocked || !pv.data.changes.length} onClick={() => run.run(async () => { await post(`${base}/manage/submit`, { rev, ...(note ? { note } : {}) }); setNote(''); await reload(); }, 'Sent to Super Admin for review.')}>Send for review</button>}
      {platform && waiting && <button type="button" className="btn btn-outline" disabled={run.busy || note.trim().length < 5} onClick={() => run.run(async () => { await post(`${base}/manage/return`, { rev, note }); setNote(''); await reload(); }, 'Sent back to the NGO')}>Send back</button>}<button type="button" className="btn btn-outline" disabled={run.busy} onClick={() => window.confirm('Throw away this draft?') && run.run(async () => { await del(`${base}/manage/draft`); await reload(); }, 'Draft discarded')}>Discard draft</button></div>
    </>}
    <h2 className="mb-2 mt-6 text-lg font-semibold">History</h2>
    {data.versions.length ? <Table caption="History" rows={data.versions.map((v: any) => ({ ...v, id: v.number }))} columns={[{ key: 'number', label: 'Version' }, { key: 'status', label: 'Status' }, { key: 'publishedAt', label: 'Published' }, { key: 'by', label: 'Published by' }, { key: 'askedBy', label: 'Asked for by' }, { key: 'note', label: 'Note' }]} actions={(v) => v.status !== 'PUBLISHED' && <Small disabled={run.busy || dirty} label={`Copy version ${v.number} to the draft`} onClick={() => { if (!rev || window.confirm('Replace the current draft?')) void run.run(async () => { await post(`${base}/manage/restore/${v.number}`); await reload(); }, 'Copied to the draft. Check it, then publish.'); }}>Go back to this</Small>} /> : <Empty>Nothing published yet.</Empty>}
    {archived.length > 0 && <><h2 className="mb-2 mt-6 text-lg font-semibold">Archived</h2><Table caption="Archived" rows={archived} columns={[{ key: 'label', label: 'What' }]} actions={(x) => <span className="inline-flex gap-1">{x.key && <Small label={`Download ${x.label}`} onClick={() => run.run(async () => { const r = await api(`${base}/manage/export?entity=${encodeURIComponent(x.entity)}&key=${x.key}`); saveText(r.filename, r.csv); })}>Download</Small>}{platform && <Small danger label={`Delete ${x.label} for good`} onClick={() => { setTyped(''); setPurge(x); }}>Delete for good</Small>}</span>} /></>}
    <Dialog title="Delete for good" open={purge !== null} onClose={() => setPurge(null)}>{purge && <form onSubmit={(e) => { e.preventDefault(); void run.run(async () => { await post(`${base}/manage/purge`, { entity: purge.entity, key: purge.key, confirm: typed }); setPurge(null); await reload(); }, 'Deleted for good'); }}><Feedback action={run} /><Notice kind="error">This removes {purge.label} and everything stored in it. It cannot be undone.</Notice><Text label={`Type ${purge.key ?? purge.entity.slice(2)} to confirm`} value={typed} onChange={setTyped} required /><button className="btn btn-danger" disabled={run.busy}>Delete for good</button></form>}</Dialog>
  </>;
}
