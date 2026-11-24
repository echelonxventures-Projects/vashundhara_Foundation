import { RECORDS, REF_LABELS, tableOf, type CustomField, type CustomTable, type EntityStructure, type Permission, type RecordDef, type RecordField, type TableAction } from '@vashundhara-foundation/shared';
/** `custom` marks a field the NGO added itself. */
export type F = RecordField & { custom?: CustomField; choices?: { value: string; label: string }[] };
export interface R extends RecordDef {
  own?: boolean; filters?: CustomField[]; exportPath?: string;
  fields: F[];
  actions?: { label: string; when?: (r: any) => boolean; perm: Permission; method: 'POST' | 'PUT'; url: (r: any) => string; body?: (r: any) => unknown; confirm?: string }[];
  links?: { label: string; href: (r: any) => string }[];
}
const vol = (label: string, status: string, when: (r: any) => boolean) => ({ label, when, perm: 'volunteers:update' as const, method: 'PUT' as const, url: (r: any) => `volunteering/${r.id}/decision`, body: () => ({ status }) });
const ben = (label: string, status: string, from: string[]) => ({ label, when: (r: any) => from.includes(r.status), perm: 'beneficiaries:update' as const, method: 'PUT' as const, url: (r: any) => `beneficiary-services/${r.id}/decision`, body: () => ({ status }) });
const soc = (label: string, action: string, from: string[], perm: Permission = 'social:manage') => ({ label, when: (r: any) => from.includes(r.status), perm, method: (action === 'submit' ? 'POST' : 'PUT') as 'POST' | 'PUT', url: (r: any) => (action === 'submit' ? `social-workflow/${r.id}/submit` : `social-workflow/${r.id}`), body: () => (action === 'submit' ? {} : { action }) });
/** Buttons on top of the shared record list. */
const EXTRA: Record<string, Pick<R, 'actions' | 'links'>> = {
  campaigns: { links: [{ label: 'View', href: (r) => `/campaigns/${r.slug}` }] },
  subscriptions: { actions: [{ label: 'Cancel', when: (r) => ['ACTIVE', 'CREATED', 'PAUSED'].includes(r.status), perm: 'subscriptions:update', method: 'PUT', url: (r) => `subscriptions/${r.id}/cancel`, confirm: 'Cancel this recurring gift?' }] },
  receipts: { links: [{ label: 'PDF', href: (r) => `/api/receipts/${r.id}/pdf` }] },
  volunteers: { actions: [vol('Approve', 'ACTIVE', (r) => r.status !== 'ACTIVE'), vol('Pause', 'ON_HOLD', (r) => r.status === 'ACTIVE'), { label: 'Certificate', when: (r) => Number(r.totalHours) > 0, perm: 'certificates:create', method: 'POST', url: () => 'volunteering/certificates', body: (r) => ({ volunteerId: r.id, title: 'Certificate of appreciation' }), confirm: 'Issue a certificate for the hours so far?' }] },
  shifts: { links: [{ label: 'Roster', href: (r) => `/staff/roster/${r.id}` }] },
  hours: { actions: ['APPROVED', 'REJECTED'].map((status) => ({ label: status === 'APPROVED' ? 'Approve' : 'Reject', when: (r: any) => r.status === 'PENDING', perm: 'hours:manage' as const, method: 'PUT' as const, url: (r: any) => `volunteering/hours/${r.id}`, body: () => ({ status }) })) },
  beneficiaries: { actions: [ben('Approve', 'APPROVED', ['APPLIED', 'REJECTED']), ben('Reject', 'REJECTED', ['APPLIED']), ben('Start', 'ACTIVE', ['APPROVED', 'EXITED']), ben('Exit', 'EXITED', ['ACTIVE', 'APPROVED'])] },
  courses: { links: [{ label: 'Gradebook', href: (r) => `/staff/gradebook/${r.id}` }] },
  assignments: { links: [{ label: 'Mark work', href: (r) => `/staff/marking/${r.id}` }] },
  events: { links: [{ label: 'Check-in', href: (r) => `/staff/event-desk/${r.id}` }] },
  social: { actions: [soc('Send for review', 'submit', ['DRAFT', 'FAILED'], 'social:update'), soc('Approve', 'approve', ['IN_REVIEW']), soc('Back to draft', 'return', ['IN_REVIEW', 'APPROVED', 'SCHEDULED']), soc('Mark as published', 'published', ['APPROVED', 'SCHEDULED'])] },
  messages: { actions: [{ label: 'Mark handled', when: (r) => !r.handledAt, perm: 'messages:update', method: 'PUT', url: (r) => `messages/${r.id}/handled` }] },
  feedback: { actions: [['Approve', 'APPROVED'], ['Hide', 'HIDDEN']].map(([label, status]) => ({ label, when: (r: any) => r.status !== status, perm: 'feedback:update' as const, method: 'PUT' as const, url: (r: any) => `feedback/${r.id}`, body: () => ({ status }) })) },
  invoices: { actions: [{ label: 'Record payment', when: (r) => ['SENT', 'OVERDUE'].includes(r.status), perm: 'finance:manage', method: 'POST', url: (r) => `invoice-payments/${r.id}`, confirm: 'Record this invoice as paid?' }] },
  webhooks: { actions: [{ label: 'Test', perm: 'webhooks:update', method: 'POST', url: (r) => `webhooks/${r.id}/test` }] },
  'data-requests': { actions: [{ label: 'Complete', when: (r) => ['OPEN', 'IN_PROGRESS'].includes(r.status), perm: 'privacy:manage', method: 'PUT', url: (r) => `privacy/requests/${r.id}`, body: () => ({ status: 'COMPLETED', resolution: 'Completed as requested' }), confirm: 'For a deletion request this permanently removes personal details. Continue?' }] }
};
export const STAFF: Record<string, R> = Object.fromEntries(Object.entries(RECORDS).map(([k, r]) => [k, { ...r, ...EXTRA[k] }]));

export interface MyStructure { entities: Record<string, EntityStructure>; tables: (CustomTable & { can: TableAction[] })[]; forms: { key: string; title: string; table: string }[]; canManage: boolean }
export const NO_STRUCTURE: MyStructure = { entities: {}, tables: [], forms: [], canManage: false };
const refOf = (target: string) => { const t = tableOf(target); return t ? { path: `records/${t}`, label: 'title' } : { path: RECORDS[target].path, label: REF_LABELS[target] }; };
const TYPE: Record<string, RecordField['type']> = { phone: 'text', url: 'text' };
/** An NGO's field, in the form the record screens understand. */
export const ownField = (c: CustomField): F => ({ key: `custom.${c.key}`, label: c.label, type: TYPE[c.type] ?? (c.type as RecordField['type']), required: c.type === 'bool' ? false : c.required, hint: c.hint, custom: c, choices: c.choices?.filter((x) => !x.archived), ...(c.type === 'ref' && c.ref ? { ref: refOf(c.ref) } : {}) });
/** A built-in screen with the NGO's own fields, names, order and columns applied. */
export function withStructure(name: string, s: MyStructure): R {
  const r = STAFF[name];
  const e = s.entities[name];
  if (!e) return r;
  const l = e.layout ?? {};
  const own = e.fields.filter((f) => !f.archived);
  const hidden = new Set(l.hidden ?? []);
  const fields: F[] = [...r.fields.filter((f) => !hidden.has(f.key)).map((f) => ({ ...f, label: l.labels?.[f.key] ?? f.label, required: f.required || l.required?.includes(f.key), ...(l.choices?.[f.key] ? { type: 'select' as const, choices: l.choices[f.key].map((c) => ({ value: c, label: c })) } : {}) })), ...own.map(ownField)];
  const at = (k: string) => { const i = l.order?.indexOf(k) ?? -1; return i < 0 ? 1000 : i; };
  if (l.order) fields.sort((a, b) => at(a.key) - at(b.key));
  const all: [string, string][] = [...r.columns.filter(([k]) => !hidden.has(k)).map(([k, t]): [string, string] => [k, l.labels?.[k] ?? t]), ...own.map((f): [string, string] => [`custom.${f.key}`, f.label])];
  const columns = l.columns ? all.filter(([k]) => l.columns!.includes(k)) : all.filter(([k]) => !k.startsWith('custom.') || own.some((f) => f.list && k === `custom.${f.key}`));
  return { ...r, title: l.title ?? r.title, fields, columns: columns.length ? columns : all.slice(0, 1), filters: own.filter((f) => f.filter) };
}
/** The screen for one of the NGO's own tables. */
export function tableScreen(t: MyStructure['tables'][number]): R {
  const fields = t.fields.filter((f) => !f.archived);
  const listed = fields.filter((f) => f.list);
  return { title: t.title, resource: 'records', group: t.group ?? 'Own tables', path: `records/${t.key}`, own: true, search: true, fields: fields.map(ownField), filters: fields.filter((f) => f.filter), exportPath: `records/${t.key}/export`, columns: (listed.length ? listed : fields.slice(0, 5)).map((f) => [`custom.${f.key}`, f.label]), noCreate: !t.can.includes('create'), noEdit: !t.can.includes('update'), noDelete: !t.can.includes('delete') };
}
