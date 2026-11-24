import { RECORDS } from './records';

/**
 * An NGO's own structure: extra fields, screen layout, custom tables, forms and rules.
 * It is data, not database schema, so one NGO's change never touches another.
 * Super Admin manages it; an NGO Admin only when Super Admin permits that NGO.
 */
export const CUSTOM_TYPES = ['text', 'textarea', 'number', 'money', 'date', 'datetime', 'bool', 'select', 'multi', 'email', 'phone', 'url', 'file', 'ref'] as const;
export type CustomType = (typeof CUSTOM_TYPES)[number];
export interface Choice { value: string; label: string; archived?: boolean }
export interface CustomField {
  key: string; label: string; type: CustomType; hint?: string; required?: boolean; unique?: boolean; personal?: boolean;
  list?: boolean; search?: boolean; filter?: boolean; choices?: Choice[]; ref?: string; min?: number; max?: number; archived?: boolean;
}
export interface Layout { title?: string; labels?: Record<string, string>; hidden?: string[]; required?: string[]; order?: string[]; columns?: string[]; choices?: Record<string, string[]> }
export interface EntityStructure { fields: CustomField[]; layout?: Layout }
export const TABLE_ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type TableAction = (typeof TABLE_ACTIONS)[number];
export interface CustomTable { key: string; title: string; group?: string; fields: CustomField[]; access?: Partial<Record<TableAction, string[]>>; archived?: boolean }
export interface FormDef { key: string; title: string; intro?: string; success?: string; table: string; access: 'PUBLIC' | 'MEMBERS'; active: boolean; fields: { key: string; required?: boolean }[] }
export const RULE_OPS = ['eq', 'ne', 'gt', 'lt', 'contains', 'filled', 'empty', 'changed'] as const;
export interface RuleCondition { field: string; op: (typeof RULE_OPS)[number]; value?: string }
export type RuleAction =
  | { type: 'NOTIFY_ROLE'; role: string; channel: 'EMAIL' | 'IN_APP'; subject: string; body: string }
  | { type: 'EMAIL_FIELD'; field: string; subject: string; body: string }
  | { type: 'TASK'; subject: string; dueInDays: number }
  | { type: 'WEBHOOK' };
export interface RuleDef { key: string; name: string; entity: string; on: 'CREATED' | 'UPDATED' | 'SAVED'; active: boolean; conditions: RuleCondition[]; actions: RuleAction[] }
export interface Definition { entities: Record<string, EntityStructure>; tables: CustomTable[]; forms: FormDef[]; rules: RuleDef[] }
export const emptyDefinition = (): Definition => ({ entities: {}, tables: [], forms: [], rules: [] });

export const KEY = /^[a-z][a-z0-9_]{1,39}$/;
/** Who may use a table when nobody else is named. The NGO Administrator always may. */
export const DEFAULT_ACCESS = ['manager'];
export const tableAllows = (t: CustomTable, action: TableAction, roles: string[]): boolean =>
  roles.includes('system_admin') || roles.includes('tenant_admin') || (t.access?.[action] ?? (action === 'read' ? DEFAULT_ACCESS : t.access?.read ?? DEFAULT_ACCESS)).some((r) => roles.includes(r));
export const keyFrom = (label: string): string => {
  const k = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return KEY.test(k) ? k : `f_${k}`.replace(/_+$/, '').padEnd(3, 'x').slice(0, 40);
};

/** Records an NGO may extend. Everything else (payments, receipts, ledger, logins, audit, consent) is locked. */
export const EXTENDABLE = ['campaigns', 'donors', 'donations', 'contacts', 'organizations', 'deals', 'activities', 'volunteers', 'shifts', 'skills', 'beneficiaries', 'cases', 'aid', 'programmes', 'indicators', 'readings', 'students', 'courses', 'lessons', 'classes', 'assignments', 'library', 'events', 'social', 'pages', 'grants', 'utilisation', 'invoices'] as const;
/** Extra fields are fine here, but the built-in screen must stay as it is. */
export const LAYOUT_LOCKED = new Set<string>(['donations', 'invoices', 'utilisation']);
/** Consent, tax identity, amounts and workflow states: never hidden or re-listed. */
export const LOCKED_FIELDS = new Set(['consentAt', 'guardianConsentAt', 'marketingConsent', 'isIndianCitizen', 'pan', 'is80GEligible', 'status', 'amountMinor', 'goalMinor', 'valueMinor', 'isPublic']);
export const isExtendable = (e: string): boolean => (EXTENDABLE as readonly string[]).includes(e);
/** Records a link field may point at, and what to show for them. */
export const REF_LABELS: Record<string, string> = { campaigns: 'title', donors: 'fullName', contacts: 'firstName lastName', organizations: 'name', deals: 'title', activities: 'subject', volunteers: 'firstName lastName', shifts: 'title', skills: 'name', beneficiaries: 'fullName', cases: 'title', programmes: 'name', indicators: 'name', students: 'fullName', courses: 'title', lessons: 'title', classes: 'title', assignments: 'title', library: 'title', events: 'title', social: 'title', pages: 'title', grants: 'title', invoices: 'number' };
export const entityTitle = (e: string): string => (e === 'donations' ? 'Donations' : RECORDS[e]?.title ?? e);
/** "x:trips" means the custom table called trips; anything else is a built-in record. */
export const tableOf = (entity: string): string | null => (entity.startsWith('x:') ? entity.slice(2) : null);
export const RECORD_BY_PATH: Record<string, string> = Object.fromEntries(Object.entries(RECORDS).filter(([k]) => isExtendable(k)).map(([k, r]) => [r.path, k]));
export const builtInFields = (e: string) => (LAYOUT_LOCKED.has(e) ? [] : RECORDS[e]?.fields ?? []);
/** Fields a rule may read: plain values only, never PAN or addresses. */
export const ruleFields = (d: Definition, entity: string): { key: string; label: string }[] => {
  const t = tableOf(entity);
  if (t) return (d.tables.find((x) => x.key === t)?.fields ?? []).filter((f) => !f.archived).map((f) => ({ key: f.key, label: f.label }));
  const built = (RECORDS[entity]?.fields ?? []).filter((f) => !['pan', 'notes'].includes(f.key) && !['address', 'stages', 'image', 'file'].includes(f.type ?? '')).map((f) => ({ key: f.key, label: f.label }));
  return [...built, ...(d.entities[entity]?.fields ?? []).filter((f) => !f.archived).map((f) => ({ key: `custom.${f.key}`, label: f.label }))];
};
/** Choices may only be set on plain text fields; the code depends on the others. */
export const choiceable = (e: string) => builtInFields(e).filter((f) => (!f.type || f.type === 'text') && !LOCKED_FIELDS.has(f.key) && !/slug|email|phone|url|path|name|title|subject|number/i.test(f.key));

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/,/g, '')) : NaN);
const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
export const isEmpty = empty;

/** Turns input into the stored form, or returns a message saying what is wrong. Empty becomes null. */
export function coerceValue(f: CustomField, raw: unknown, old?: unknown): { value: unknown } | { error: string } {
  if (empty(raw)) return f.type === 'bool' ? { value: false } : { value: null };
  if (typeof raw === 'object' && !Array.isArray(raw)) return { error: 'Not a valid value' };
  const s = Array.isArray(raw) ? raw.join(', ') : String(raw).trim();
  const range = (n: number, what: string) => (f.min !== undefined && n < f.min ? { error: `${what} at least ${f.min}` } : f.max !== undefined && n > f.max ? { error: `${what} at most ${f.max}` } : null);
  switch (f.type) {
    case 'text': case 'textarea': {
      const max = f.type === 'text' ? 300 : 10_000;
      if (s.length > max) return { error: `At most ${max} characters` };
      return range(s.length, 'Length must be') ?? { value: s };
    }
    case 'number': case 'money': {
      const n = num(raw);
      if (!Number.isFinite(n) || Math.abs(n) > 1e13) return { error: 'Enter a number' };
      if (f.type === 'money' && !Number.isInteger(n)) return { error: 'Enter an amount' };
      return range(f.type === 'money' ? n / 100 : n, 'Must be') ?? { value: n };
    }
    case 'bool':
      if (raw === true || /^(true|yes|1|on)$/i.test(s)) return { value: true };
      if (raw === false || /^(false|no|0|off)$/i.test(s)) return { value: false };
      return { error: 'Enter yes or no' };
    case 'date': {
      const m = /^(\d{4})-(\d\d)-(\d\d)(T.*)?$/.exec(s);
      const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
      if (!m || !d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return { error: 'Enter a date as YYYY-MM-DD' };
      return { value: `${m[1]}-${m[2]}-${m[3]}` };
    }
    case 'datetime': {
      const d = /^\d{4}-\d\d-\d\d/.test(s) ? new Date(s) : new Date(NaN);
      return Number.isNaN(d.getTime()) ? { error: 'Enter a date and time' } : { value: d.toISOString() };
    }
    case 'select': {
      const c = f.choices?.find((x) => x.value === s) ?? f.choices?.find((x) => x.label.toLowerCase() === s.toLowerCase());
      if (!c || (c.archived && old !== c.value)) return { error: 'Choose one of the options' };
      return { value: c.value };
    }
    case 'multi': {
      const xs = Array.isArray(raw) ? raw.map(String) : s.split(',').map((x) => x.trim()).filter(Boolean);
      const out: string[] = [];
      for (const x of xs) {
        const c = f.choices?.find((y) => y.value === x) ?? f.choices?.find((y) => y.label.toLowerCase() === x.toLowerCase());
        if (!c || (c.archived && !(Array.isArray(old) && old.includes(c.value)))) return { error: 'Choose from the options' };
        if (!out.includes(c.value)) out.push(c.value);
      }
      return { value: out };
    }
    case 'email': return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(s) && s.length <= 200 ? { value: s.toLowerCase() } : { error: 'Enter an email address' };
    case 'phone': return /^\+?[\d\s()-]{6,20}$/.test(s) ? { value: s } : { error: 'Enter a phone number' };
    case 'url': return /^https?:\/\/[^\s<>"]+$/i.test(s) && s.length <= 500 ? { value: s } : { error: 'Enter a link starting with https://' };
    case 'file': case 'ref': return /^[0-9a-f-]{36}$/i.test(s) ? { value: s } : { error: 'Not found' };
  }
}

export interface Problem { where: string; message: string }
const dup = (xs: string[]) => xs.find((x, i) => xs.indexOf(x) !== i);

function fieldProblems(where: string, fields: CustomField[], d: Definition, out: Problem[]) {
  const twice = dup(fields.map((f) => f.key));
  if (twice) out.push({ where, message: `Two fields share the key "${twice}"` });
  for (const f of fields) {
    const at = `${where} > ${f.label}`;
    if (!KEY.test(f.key)) out.push({ where: at, message: 'The key may only use lowercase letters, numbers and _' });
    if (f.archived) continue;
    if ((f.type === 'select' || f.type === 'multi') && !f.choices?.some((c) => !c.archived)) out.push({ where: at, message: 'Add at least one choice' });
    const c = dup((f.choices ?? []).map((x) => x.value));
    if (c) out.push({ where: at, message: `The choice "${c}" is listed twice` });
    if (f.type === 'ref') {
      const t = f.ref ? tableOf(f.ref) : null;
      if (!f.ref || (t ? !d.tables.some((x) => x.key === t && !x.archived)  : !(f.ref in REF_LABELS))) out.push({ where: at, message: 'Choose which records it links to' });
    }
    if (f.min !== undefined && f.max !== undefined && f.min > f.max) out.push({ where: at, message: 'The minimum is above the maximum' });
    if (f.unique && ['bool', 'multi', 'file', 'textarea'].includes(f.type)) out.push({ where: at, message: 'This type cannot be unique' });
  }
}

/** Everything that would stop this structure from being published. */
export function checkDefinition(d: Definition): Problem[] {
  const out: Problem[] = [];
  for (const [e, s] of Object.entries(d.entities)) {
    const where = entityTitle(e);
    if (!isExtendable(e)) { out.push({ where, message: 'This record is locked and cannot be changed' }); continue; }
    fieldProblems(where, s.fields, d, out);
    const l = s.layout;
    if (!l) continue;
    const used = [l.title, ...Object.values(l.labels ?? {}), ...(l.hidden ?? []), ...(l.required ?? []), ...(l.order ?? []), ...(l.columns ?? []), ...Object.keys(l.choices ?? {})].filter(Boolean);
    if (LAYOUT_LOCKED.has(e)) { if (used.length) out.push({ where, message: 'Only extra fields can be added here' }); continue; }
    const built = new Map(builtInFields(e).map((f) => [f.key, f]));
    for (const k of l.hidden ?? []) {
      if (!built.has(k)) out.push({ where, message: `Unknown field "${k}"` });
      else if (built.get(k)!.required || LOCKED_FIELDS.has(k)) out.push({ where, message: `"${built.get(k)!.label}" cannot be hidden` });
      else if (l.required?.includes(k)) out.push({ where, message: `"${built.get(k)!.label}" cannot be both hidden and required` });
    }
    for (const k of Object.keys(l.labels ?? {})) if (!built.has(k) || LOCKED_FIELDS.has(k)) out.push({ where, message: `"${built.get(k)?.label ?? k}" cannot be renamed` });
    for (const k of l.required ?? []) if (!built.has(k) || ['bool', 'tags', 'multi'].includes(built.get(k)!.type ?? '') || LOCKED_FIELDS.has(k)) out.push({ where, message: `"${built.get(k)?.label ?? k}" cannot be made required` });
    const ok = choiceable(e).map((f) => f.key);
    for (const [k, cs] of Object.entries(l.choices ?? {})) if (!ok.includes(k)) out.push({ where, message: `"${built.get(k)?.label ?? k}" cannot have its own choices` }); else if (!cs.length) out.push({ where, message: `Add at least one choice for "${built.get(k)!.label}"` });
  }
  const tables = d.tables.filter((t) => !t.archived);
  const t2 = dup(d.tables.map((t) => t.key));
  if (t2) out.push({ where: 'Tables', message: `Two tables share the key "${t2}"` });
  for (const t of d.tables) {
    if (!KEY.test(t.key)) out.push({ where: t.title, message: 'The key may only use lowercase letters, numbers and _' });
    if (t.archived) continue;
    fieldProblems(t.title, t.fields, d, out);
    const first = t.fields.find((f) => !f.archived);
    if (!first) out.push({ where: t.title, message: 'Add at least one field' });
  }
  const f2 = dup(d.forms.map((f) => f.key));
  if (f2) out.push({ where: 'Forms', message: `Two forms share the key "${f2}"` });
  for (const f of d.forms) {
    if (!KEY.test(f.key)) out.push({ where: f.title, message: 'The key may only use lowercase letters, numbers and _' });
    const t = tables.find((x) => x.key === f.table);
    if (!t) { if (f.active) out.push({ where: f.title, message: 'Choose the table it saves into' }); continue; }
    if (!f.active) continue;
    if (!f.fields.length) out.push({ where: f.title, message: 'Add at least one field' });
    for (const x of f.fields) {
      const field = t.fields.find((y) => y.key === x.key && !y.archived);
      if (!field) out.push({ where: f.title, message: `The field "${x.key}" does not exist` });
      else if (['file', 'ref'].includes(field.type)) out.push({ where: f.title, message: `"${field.label}" cannot be on a form, because forms may not upload files or list records` });
    }
    for (const r of t.fields.filter((y) => y.required && !y.archived)) if (!f.fields.some((x) => x.key === r.key)) out.push({ where: f.title, message: `"${r.label}" is required, so it must be on the form` });
  }
  const r2 = dup(d.rules.map((r) => r.key));
  if (r2) out.push({ where: 'Rules', message: `Two rules share the key "${r2}"` });
  for (const r of d.rules) {
    if (!KEY.test(r.key)) out.push({ where: r.name, message: 'The key may only use lowercase letters, numbers and _' });
    if (!r.active) continue;
    const t = tableOf(r.entity);
    if (t ? !tables.some((x) => x.key === t) : !isExtendable(r.entity) || r.entity === 'donations') { out.push({ where: r.name, message: 'Choose which records it watches' }); continue; }
    const keys = ruleFields(d, r.entity).map((x) => x.key);
    for (const c of r.conditions) if (!keys.includes(c.field)) out.push({ where: r.name, message: `The field "${c.field}" does not exist` });
    if (!r.actions.length) out.push({ where: r.name, message: 'Add at least one action' });
    for (const a of r.actions) if (a.type === 'EMAIL_FIELD' && !keys.includes(a.field)) out.push({ where: r.name, message: 'Choose the email field' });
  }
  return out;
}

const keepFields = (before: CustomField[], after: CustomField[]): CustomField[] => [
  ...after.map((f) => {
    const gone = (before.find((b) => b.key === f.key)?.choices ?? []).filter((c) => f.choices && !f.choices.some((x) => x.value === c.value));
    return gone.length ? { ...f, choices: [...f.choices!, ...gone.map((c) => ({ ...c, archived: true }))] } : f;
  }),
  ...before.filter((b) => !after.some((f) => f.key === b.key)).map((b) => ({ ...b, archived: true }))
];
/** Removing a published field, choice or table archives it, so its data is never orphaned or reused by accident. */
export function keepRemoved(before: Definition, after: Definition): Definition {
  const entities: Record<string, EntityStructure> = { ...after.entities };
  for (const [e, b] of Object.entries(before.entities)) entities[e] = { ...(after.entities[e] ?? {}), fields: keepFields(b.fields, after.entities[e]?.fields ?? []) };
  const tables = [
    ...after.tables.map((t) => { const b = before.tables.find((x) => x.key === t.key); return b ? { ...t, fields: keepFields(b.fields, t.fields) } : t; }),
    ...before.tables.filter((b) => !after.tables.some((t) => t.key === b.key)).map((b) => ({ ...b, archived: true }))
  ];
  return { ...after, entities, tables };
}

export interface FieldPair { entity: string; key: string; label: string; before?: CustomField; after?: CustomField }
/** Every custom field that differs between two definitions. */
export function changedFields(before: Definition, after: Definition): FieldPair[] {
  const out: FieldPair[] = [];
  const both = (entity: string, b: CustomField[], a: CustomField[]) => {
    for (const key of new Set([...b, ...a].map((f) => f.key))) {
      const x = b.find((f) => f.key === key), y = a.find((f) => f.key === key);
      if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ entity, key, label: (y ?? x)!.label, before: x, after: y });
    }
  };
  for (const e of new Set([...Object.keys(before.entities), ...Object.keys(after.entities)])) both(e, before.entities[e]?.fields ?? [], after.entities[e]?.fields ?? []);
  for (const t of new Set([...before.tables, ...after.tables].map((x) => x.key))) both(`x:${t}`, before.tables.find((x) => x.key === t)?.fields ?? [], after.tables.find((x) => x.key === t)?.fields ?? []);
  return out;
}

/** Adds a template's parts to a definition. Parts that already exist are left alone and reported. */
export function applyTemplate(base: Definition, tpl: Definition): { definition: Definition; skipped: string[] } {
  const d: Definition = structuredClone(base);
  const skipped: string[] = [];
  const addFields = (where: string, to: CustomField[], from: CustomField[]) => { for (const f of from) if (to.some((x) => x.key === f.key)) skipped.push(`${where}: ${f.label}`); else to.push(structuredClone(f)); };
  for (const [e, s] of Object.entries(tpl.entities)) {
    d.entities[e] ??= { fields: [] };
    addFields(entityTitle(e), d.entities[e].fields, s.fields.filter((f) => !f.archived));
    if (s.layout) { if (d.entities[e].layout) skipped.push(`${entityTitle(e)}: layout`); else d.entities[e].layout = structuredClone(s.layout); }
  }
  for (const t of tpl.tables.filter((x) => !x.archived)) {
    const mine = d.tables.find((x) => x.key === t.key);
    if (mine) addFields(t.title, mine.fields, t.fields.filter((f) => !f.archived)); else d.tables.push(structuredClone(t));
  }
  for (const f of tpl.forms) if (d.forms.some((x) => x.key === f.key)) skipped.push(`Form: ${f.title}`); else d.forms.push(structuredClone(f));
  for (const r of tpl.rules) if (d.rules.some((x) => x.key === r.key)) skipped.push(`Rule: ${r.name}`); else d.rules.push(structuredClone(r));
  return { definition: d, skipped };
}
/** Does this record match a rule's conditions? `row` holds the rule's field keys. */
export function ruleMatches(r: RuleDef, row: Record<string, unknown>, changed: string[]): boolean {
  return r.conditions.every((c) => {
    const v = row[c.field];
    const s = Array.isArray(v) ? v.join(',') : v === null || v === undefined ? '' : String(v);
    switch (c.op) {
      case 'eq': return s.toLowerCase() === (c.value ?? '').toLowerCase();
      case 'ne': return s.toLowerCase() !== (c.value ?? '').toLowerCase();
      case 'gt': return s !== '' && (Number.isNaN(Number(s)) ? s > (c.value ?? '') : Number(s) > Number(c.value));
      case 'lt': return s !== '' && (Number.isNaN(Number(s)) ? s < (c.value ?? '') : Number(s) < Number(c.value));
      case 'contains': return s.toLowerCase().includes((c.value ?? '').toLowerCase());
      case 'filled': return !empty(v);
      case 'empty': return empty(v);
      case 'changed': return changed.includes(c.field);
    }
  });
}
