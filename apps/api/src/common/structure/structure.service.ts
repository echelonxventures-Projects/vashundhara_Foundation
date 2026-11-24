import { BadRequestException, ConflictException, ForbiddenException, Global, Injectable, Module, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { applyTemplate, changedFields, checkDefinition, coerceValue, CustomField, CustomTable, Definition, emptyDefinition, entityTitle, FieldPair, hasPermission, isEmpty, keepRemoved, RECORDS, REF_LABELS, TableAction, tableAllows, tableOf } from '@vashundhara-foundation/shared';
import { AuditService } from '../audit/audit.service';
import { getCtx, requireTenant, runAsSystem } from '../context/context';
import { JobsService } from '../jobs/jobs.module';
import { PrismaService } from '../prisma/prisma.module';
import { RedisService } from '../redis/redis.module';

type Row = Record<string, any>;
type Detail = { path: string; message: string };
export const ENTITY_MODEL: Record<string, string> = { campaigns: 'campaign', donors: 'donor', donations: 'donation', contacts: 'contact', organizations: 'organization', deals: 'deal', activities: 'crmActivity', volunteers: 'volunteer', shifts: 'shift', skills: 'skill', beneficiaries: 'beneficiary', cases: 'beneficiaryCase', aid: 'aidRecord', programmes: 'programme', indicators: 'indicator', readings: 'indicatorReading', students: 'student', courses: 'course', lessons: 'lesson', classes: 'liveClass', assignments: 'assignment', library: 'libraryItem', events: 'event', social: 'socialPost', pages: 'page', grants: 'grant', utilisation: 'grantUtilisation', invoices: 'invoice' };
const SOFT = new Set(Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === 'deletedAt')).map((m) => m.name.toLowerCase()));
const invalid = (details: Detail[]) => new UnprocessableEntityException({ message: 'Please check the highlighted fields', code: 'VALIDATION', details });
const MAX_CONVERT = 20_000;
const json = (v: unknown) => v as Prisma.InputJsonValue;
export const likeText = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
export interface Change { where: string; message: string; records?: number; blocked?: boolean }

/** Reads, checks and publishes an NGO's structure, and validates the values stored under it. Every query is tenant-scoped. */
@Injectable()
export class StructureService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly audit: AuditService, private readonly jobs: JobsService) {}

  // ---------- reading ----------
  private async load(db: any): Promise<Definition> {
    const v = await db.structureVersion.findFirst({ where: { status: 'PUBLISHED' }, select: { definition: true } });
    return (v?.definition as Definition | undefined) ?? emptyDefinition();
  }
  /** The live structure. Cached briefly; writers use `locked` instead. */
  published(): Promise<Definition> {
    return this.redis.cached(`structure:${requireTenant().id}`, 60, () => this.load(this.prisma));
  }
  private async bust() { await this.redis.del(`structure:${requireTenant().id}`); }
  /** Holds off publishing until this write commits, so a value is never checked against an old definition. */
  async locked(tx: any): Promise<Definition> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${`structure:${requireTenant().id}`}))`;
    return this.load(tx);
  }
  async table(key: string, action: TableAction): Promise<CustomTable> {
    return this.pick(await this.published(), key, action);
  }
  pick(d: Definition, key: string, action: TableAction): CustomTable {
    const t = d.tables.find((x) => x.key === key && !x.archived);
    if (!t) throw new NotFoundException('Table not found');
    if (!tableAllows(t, action, getCtx()?.roles ?? [])) throw new ForbiddenException('You do not have access to this table');
    return t;
  }
  fieldsOf(d: Definition, entity: string): CustomField[] {
    const t = tableOf(entity);
    return (t ? d.tables.find((x) => x.key === t)?.fields : d.entities[entity]?.fields) ?? [];
  }
  /** Drops archived fields from stored data. */
  show(fields: CustomField[], data: Row): Row {
    return Object.fromEntries(fields.filter((f) => !f.archived && data[f.key] !== undefined).map((f) => [f.key, data[f.key]]));
  }
  async valuesFor(entity: string, ids: string[], db: any = this.prisma): Promise<Map<string, Row>> {
    const rows = ids.length ? await db.customValue.findMany({ where: { entity, recordId: { in: ids } }, select: { recordId: true, data: true } }) : [];
    return new Map(rows.map((r: Row) => [r.recordId, r.data as Row]));
  }
  /** Names for link fields, only for records this person may read. */
  async refLabels(d: Definition, fields: CustomField[], datas: Row[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const ctx = getCtx();
    const wanted = new Map<string, Set<string>>();
    for (const f of fields) if (f.type === 'ref' && f.ref && !f.archived) for (const x of datas) if (x[f.key]) (wanted.get(f.ref) ?? wanted.set(f.ref, new Set()).get(f.ref)!).add(x[f.key]);
    for (const [target, ids] of wanted) {
      const id = { in: [...ids] };
      const t = tableOf(target);
      if (t) {
        const table = d.tables.find((x) => x.key === t);
        const ok = Boolean(table) && hasPermission(ctx?.permissions ?? [], 'records:read') && tableAllows(table!, 'read', ctx?.roles ?? []);
        for (const r of ok ? await this.prisma.customRecord.findMany({ where: { tableKey: t, id, deletedAt: null }, select: { id: true, title: true } }) : []) out[r.id] = r.title;
      } else if (hasPermission(ctx?.permissions ?? [], `${RECORDS[target]?.resource}:read`)) {
        const cols = REF_LABELS[target].split(' ');
        for (const r of await (this.prisma as any)[ENTITY_MODEL[target]].findMany({ where: this.live(target, { id }), select: { id: true, ...Object.fromEntries(cols.map((c) => [c, true])) } })) out[r.id] = cols.map((c) => r[c]).join(' ');
      }
      for (const i of ids) out[i] ??= 'Linked record';
    }
    return out;
  }
  private live(entity: string, where: Row) { return SOFT.has(ENTITY_MODEL[entity].toLowerCase()) ? { ...where, deletedAt: null } : where; }

  // ---------- writing values ----------
  /** Validates input against the fields and returns the complete data to store. */
  async clean(tx: any, entity: string, fields: CustomField[], input: Row, old: Row, recordId: string | null, prefix = ''): Promise<Row> {
    const details: Detail[] = [];
    const active = fields.filter((f) => !f.archived);
    const out: Row = { ...old };
    for (const k of Object.keys(input)) if (!active.some((f) => f.key === k)) details.push({ path: prefix + k, message: 'Unknown field' });
    for (const f of active) {
      const path = prefix + f.key;
      if (!Object.hasOwn(input, f.key)) {
        if (recordId === null && f.required && f.type !== 'bool') details.push({ path, message: `${f.label} is required` });
        continue;
      }
      const r = coerceValue(f, input[f.key], old[f.key]);
      if ('error' in r) { details.push({ path, message: r.error }); continue; }
      if (isEmpty(r.value)) {
        if (f.required) details.push({ path, message: `${f.label} is required` });
        delete out[f.key];
        continue;
      }
      if (f.type === 'file' && r.value !== old[f.key] && !(await tx.file.findFirst({ where: { id: r.value, status: { in: ['CLEAN', 'SCANNING', 'PENDING'] } }, select: { id: true } }))) { details.push({ path, message: 'File not found' }); continue; }
      if (f.type === 'ref' && r.value !== old[f.key] && !(await this.exists(tx, f.ref!, r.value as string))) { details.push({ path, message: 'Linked record not found' }); continue; }
      if (f.unique && r.value !== old[f.key] && (await this.taken(tx, entity, f.key, r.value, recordId))) { details.push({ path, message: `${f.label} is already used` }); continue; }
      out[f.key] = r.value;
    }
    if (details.length) throw invalid(details);
    return out;
  }
  private async exists(tx: any, target: string, id: string): Promise<boolean> {
    const t = tableOf(target);
    if (t) return Boolean(await tx.customRecord.findFirst({ where: { tableKey: t, id, deletedAt: null }, select: { id: true } }));
    return Boolean(ENTITY_MODEL[target] && (await tx[ENTITY_MODEL[target]].findFirst({ where: this.live(target, { id }), select: { id: true } })));
  }
  private async taken(tx: any, entity: string, key: string, value: unknown, recordId: string | null): Promise<boolean> {
    const tenantId = requireTenant().id;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`unique:${tenantId}:${entity}:${key}:${JSON.stringify(value)}`}))`;
    const needle = JSON.stringify({ [key]: value });
    const t = tableOf(entity);
    const rows = t
      ? await tx.$queryRaw`SELECT id FROM custom_records WHERE "tenantId" = ${tenantId} AND "tableKey" = ${t} AND "deletedAt" IS NULL AND data @> ${needle}::jsonb AND id <> ${recordId ?? ''} LIMIT 1`
      : await tx.$queryRaw`SELECT id FROM custom_values WHERE "tenantId" = ${tenantId} AND entity = ${entity} AND data @> ${needle}::jsonb AND "recordId" <> ${recordId ?? ''} LIMIT 1`;
    return (rows as unknown[]).length > 0;
  }
  async saveValues(tx: any, entity: string, recordId: string, input: Row | undefined, created: boolean): Promise<{ data: Row; changed: string[] }> {
    const d = await this.locked(tx);
    const fields = d.entities[entity]?.fields ?? [];
    if (!fields.length && !input) return { data: {}, changed: [] };
    const old = (await this.valuesFor(entity, [recordId], tx)).get(recordId) ?? {};
    const data = await this.clean(tx, entity, fields, input ?? {}, old, created ? null : recordId, 'custom.');
    const changed = Object.keys({ ...old, ...data }).filter((k) => JSON.stringify(old[k]) !== JSON.stringify(data[k]));
    if (changed.length) await tx.customValue.upsert({ where: { tenantId_entity_recordId: { tenantId: requireTenant().id, entity, recordId } }, create: { entity, recordId, data: json(data) }, update: { data: json(data) } });
    return { data: this.show(fields, data), changed };
  }
  /** Values for the audit log: personal fields are named but not copied. */
  forAudit(fields: CustomField[], data: Row): Row {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fields.find((f) => f.key === k)?.personal ? '[personal]' : v]));
  }
  /** The NGO's own rules on built-in fields: extra required fields and limited choices. */
  checkLayout(d: Definition, entity: string, body: Row, existing: Row | null) {
    const l = d.entities[entity]?.layout;
    if (!l) return;
    const details: Detail[] = [];
    for (const k of l.required ?? []) if (existing ? Object.hasOwn(body, k) && isEmpty(body[k]) : isEmpty(body[k])) details.push({ path: k, message: 'This is required' });
    for (const [k, cs] of Object.entries(l.choices ?? {})) if (!isEmpty(body[k]) && !cs.includes(body[k]) && body[k] !== existing?.[k]) details.push({ path: k, message: 'Choose one of the options' });
    if (details.length) throw invalid(details);
  }
  /** Record ids that match custom-field filters and the search text. */
  async idsMatching(entity: string, fields: CustomField[], filters: Row, q?: string): Promise<string[]> {
    const tenantId = requireTenant().id;
    const parts = [Prisma.sql`"tenantId" = ${tenantId}`, Prisma.sql`entity = ${entity}`, ...this.conditions(fields, filters)];
    if (q) parts.push(Prisma.sql`(${Prisma.join(fields.filter((f) => f.search && !f.archived).map((f) => Prisma.sql`data->>${f.key} ILIKE ${likeText(q)}`), ' OR ')})`);
    const rows = await this.prisma.$queryRaw<{ recordId: string }[]>`SELECT "recordId" FROM custom_values WHERE ${Prisma.join(parts, ' AND ')} LIMIT 10001`;
    if (rows.length > 10_000) { if (q) return rows.slice(0, 10_000).map((r) => r.recordId); throw new BadRequestException('Too many matches. Add another filter.'); }
    return rows.map((r) => r.recordId);
  }
  conditions(fields: CustomField[], filters: Row): Prisma.Sql[] {
    const out: Prisma.Sql[] = [];
    for (const f of fields) {
      const raw = filters[`cf_${f.key}`];
      if (f.archived || !f.filter || typeof raw !== 'string' || raw === '') continue;
      if (f.type === 'multi') { out.push(Prisma.sql`data @> ${JSON.stringify({ [f.key]: [raw] })}::jsonb`); continue; }
      const v = coerceValue({ ...f, min: undefined, max: undefined, choices: f.choices?.map((c) => ({ ...c, archived: false })) }, raw);
      if ('error' in v) { out.push(Prisma.sql`false`); continue; }
      out.push(Prisma.sql`data @> ${JSON.stringify({ [f.key]: v.value })}::jsonb`);
    }
    return out;
  }
  /** Queues the NGO's rules for this record, inside the same transaction as the change. */
  async queueRules(tx: any, d: Definition, entity: string, id: string, event: 'CREATED' | 'UPDATED', changed: string[]) {
    if (event === 'UPDATED' && !changed.length) return;
    if (d.rules.some((r) => r.active && r.entity === entity && (r.on === 'SAVED' || r.on === event))) await this.jobs.enqueue('structure.rules', { entity, id, event, changed }, { tx, tenantId: requireTenant().id, maxAttempts: 3 });
  }

  // ---------- privacy ----------
  async personalExport(u: { id: string; email: string; emailVerified: boolean }, people: { entity: string; id: string }[]) {
    const d = await this.published();
    const extra: Row[] = [];
    for (const p of people) { const v = (await this.valuesFor(p.entity, [p.id])).get(p.id); if (v) extra.push({ about: entityTitle(p.entity), ...this.show(d.entities[p.entity]?.fields ?? [], v) }); }
    for (const { t, rows } of await this.linkedRows(this.prisma, d, u, people)) for (const r of rows) extra.push({ about: t.title, createdAt: r.createdAt, ...this.show(t.fields, r.data as Row) });
    return extra;
  }
  async erasePersonal(tx: any, u: { id: string; email: string; emailVerified: boolean }, people: { entity: string; id: string }[]) {
    const d = await this.load(tx);
    for (const p of people) await tx.customValue.deleteMany({ where: { entity: p.entity, recordId: p.id } });
    for (const { t, rows } of await this.linkedRows(tx, d, u, people)) {
      const personal = new Set(t.fields.filter((f) => f.personal || f.type === 'email' || f.type === 'phone').map((f) => f.key));
      for (const r of rows) {
        const data = Object.fromEntries(Object.entries(r.data as Row).filter(([k]) => !personal.has(k)));
        const title = t.fields.find((f) => !f.archived);
        await tx.customRecord.update({ where: { id: r.id }, data: { data: json(data), ...(title && personal.has(title.key) ? { title: 'Removed on request' } : {}), createdById: null } });
      }
    }
  }
  /** Rows that are about this person: sent by them through a form, linked to their record, or carrying their email. */
  private async linkedRows(db: any, d: Definition, u: { id: string; email: string; emailVerified: boolean }, people: { entity: string; id: string }[]) {
    const out: { t: CustomTable; rows: Row[] }[] = [];
    for (const t of d.tables) {
      const or: Row[] = [{ createdById: u.id, source: 'FORM' }];
      for (const f of t.fields) {
        if (f.type === 'ref') for (const p of people) if (f.ref === p.entity) or.push({ data: { path: [f.key], equals: p.id } });
        if (f.type === 'email' && u.emailVerified) or.push({ data: { path: [f.key], equals: u.email.toLowerCase() } });
      }
      const rows = await db.customRecord.findMany({ where: { tableKey: t.key, OR: or }, take: 5000 });
      if (rows.length) out.push({ t, rows });
    }
    return out;
  }

  // ---------- managing the structure ----------
  async policy(db: any = this.prisma) {
    return (await db.structurePolicy.findFirst()) ?? { ngoAdminAllowed: false, ngoAdminPublish: false, maxFields: 150, maxTables: 20, maxForms: 20, maxRules: 20 };
  }
  async overview() {
    const [policy, live, draft, versions, roles] = await Promise.all([
      this.policy(), this.prisma.structureVersion.findFirst({ where: { status: 'PUBLISHED' } }), this.prisma.structureVersion.findFirst({ where: { status: 'DRAFT' } }),
      this.prisma.structureVersion.findMany({ where: { number: { not: null } }, orderBy: { number: 'desc' }, take: 50, select: { number: true, status: true, note: true, publishedAt: true, createdById: true, submittedById: true } }),
      this.prisma.role.findMany({ where: { scope: 'TENANT', deletedAt: null }, orderBy: { priority: 'desc' }, select: { name: true, displayName: true } })
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: [...versions.flatMap((v) => [v.createdById, v.submittedById]), draft?.submittedById, draft?.createdById].filter((x): x is string => Boolean(x)) } }, select: { id: true, email: true } });
    const email = (id?: string | null) => users.find((u) => u.id === id)?.email ?? null;
    return {
      policy, roles, live: live ? { number: live.number, publishedAt: live.publishedAt, definition: live.definition } : null,
      draft: draft ? { rev: draft.rev, updatedAt: draft.updatedAt, definition: draft.definition, editedBy: email(draft.createdById), submittedAt: draft.submittedAt, submittedBy: email(draft.submittedById), submitNote: draft.submitNote, reviewNote: draft.reviewNote } : null,
      versions: versions.map((v) => ({ ...v, by: email(v.createdById), askedBy: email(v.submittedById) }))
    };
  }
  private async limits(d: Definition, db: any = this.prisma) {
    const p = await this.policy(db);
    const fields = [...Object.values(d.entities), ...d.tables.filter((t) => !t.archived)].reduce((n, x) => n + x.fields.filter((f) => !f.archived).length, 0);
    const over = ([['fields', fields, p.maxFields], ['tables', d.tables.filter((t) => !t.archived).length, p.maxTables], ['forms', d.forms.length, p.maxForms], ['rules', d.rules.length, p.maxRules]] as const).find(([, n, max]) => n > max);
    if (over) throw new BadRequestException({ code: 'LIMIT', message: `This organisation may have at most ${over[2]} ${over[0]}. Super Admin can raise the limit.` });
  }
  /** `rev` is the draft revision the editor started from; 0 when there was no draft. */
  async saveDraft(definition: Definition, rev: number) {
    const merged = keepRemoved(await this.load(this.prisma), definition);
    await this.limits(merged);
    const by = getCtx()?.user?.id;
    if (rev === 0) {
      if (await this.prisma.structureVersion.findFirst({ where: { status: 'DRAFT' } })) throw new ConflictException({ code: 'STALE', message: 'Someone else has started a draft. Reload to see it.' });
      const v = await this.prisma.structureVersion.create({ data: { tenantId: requireTenant().id, definition: json(merged), createdById: by } });
      return { rev: v.rev, problems: checkDefinition(merged), definition: merged };
    }
    // What waits for review is exactly what was sent, so an NGO's later edit takes it out of the queue.
    const withdraw = getCtx()?.user?.isSystemAdmin ? {} : { submittedAt: null, submittedById: null, submitNote: null };
    const { count } = await this.prisma.structureVersion.updateMany({ where: { status: 'DRAFT', rev }, data: { definition: json(merged), rev: rev + 1, createdById: by, ...withdraw } });
    if (!count) throw new ConflictException({ code: 'STALE', message: 'Someone else changed this draft. Reload to see their version.' });
    return { rev: rev + 1, problems: checkDefinition(merged), definition: merged };
  }
  async discard() {
    await this.prisma.structureVersion.deleteMany({ where: { status: 'DRAFT' } });
    return { ok: true };
  }
  /** Puts the draft in Super Admin's queue. Only a draft that could be published may be sent. */
  async submit(rev: number, note?: string) {
    const { problems, changes } = await this.preview();
    const stop = [...problems, ...changes.filter((c) => c.blocked)];
    if (stop.length) throw new UnprocessableEntityException({ code: 'STRUCTURE', message: 'Fix these before sending', details: stop.map((p) => ({ path: p.where, message: p.message })) });
    if (!changes.length) throw new BadRequestException('There is nothing to review');
    const { count } = await this.prisma.structureVersion.updateMany({ where: { status: 'DRAFT', rev, submittedAt: null }, data: { submittedAt: new Date(), submittedById: getCtx()?.user?.id, submitNote: note ?? null, reviewNote: null } });
    if (!count) throw new ConflictException({ code: 'STALE', message: 'The draft has changed or was already sent. Reload to see it.' });
    await this.audit.log('CONFIG_CHANGE', 'structure', null, undefined, { submitted: rev, note });
    return { ok: true };
  }
  async withdraw() {
    const { count } = await this.prisma.structureVersion.updateMany({ where: { status: 'DRAFT', submittedAt: { not: null } }, data: { submittedAt: null, submittedById: null, submitNote: null } });
    if (!count) throw new BadRequestException('Nothing is waiting for review');
    await this.audit.log('CONFIG_CHANGE', 'structure', null, undefined, { withdrawn: true });
    return { ok: true };
  }
  /** Super Admin sends the draft back with a reason. The draft itself is kept. */
  async sendBack(rev: number, note: string) {
    const draft = await this.prisma.structureVersion.findFirst({ where: { status: 'DRAFT', rev, submittedAt: { not: null } } });
    const { count } = draft ? await this.prisma.structureVersion.updateMany({ where: { id: draft.id, rev, submittedAt: { not: null } }, data: { submittedAt: null, reviewNote: note } }) : { count: 0 };
    if (!count) throw new ConflictException({ code: 'STALE', message: 'This is no longer waiting for review. Reload to see it.' });
    await this.audit.log('CONFIG_CHANGE', 'structure', null, undefined, { returned: rev, note });
    return { submittedById: draft!.submittedById };
  }
  async preview() {
    const draft = await this.prisma.structureVersion.findFirst({ where: { status: 'DRAFT' } });
    if (!draft) return { problems: [], changes: [] as Change[] };
    const before = await this.load(this.prisma);
    const after = keepRemoved(before, draft.definition as unknown as Definition);
    return { problems: checkDefinition(after), changes: await this.changes(this.prisma, before, after) };
  }
  private async count(db: any, entity: string, key: string): Promise<number> {
    const tenantId = requireTenant().id;
    const t = tableOf(entity);
    const r = t
      ? await db.$queryRaw`SELECT count(*)::int AS n FROM custom_records WHERE "tenantId" = ${tenantId} AND "tableKey" = ${t} AND "deletedAt" IS NULL AND jsonb_exists(data, ${key})`
      : await db.$queryRaw`SELECT count(*)::int AS n FROM custom_values WHERE "tenantId" = ${tenantId} AND entity = ${entity} AND jsonb_exists(data, ${key})`;
    return (r as { n: number }[])[0].n;
  }
  /** Rows holding a value for one field, deleted rows included, so a type change leaves nothing behind. */
  private async holders(db: any, entity: string, key: string): Promise<{ id: string; data: Row }[]> {
    const tenantId = requireTenant().id;
    const t = tableOf(entity);
    return t
      ? db.$queryRaw`SELECT id, data FROM custom_records WHERE "tenantId" = ${tenantId} AND "tableKey" = ${t} AND jsonb_exists(data, ${key}) LIMIT ${MAX_CONVERT + 1}`
      : db.$queryRaw`SELECT id, data FROM custom_values WHERE "tenantId" = ${tenantId} AND entity = ${entity} AND jsonb_exists(data, ${key}) LIMIT ${MAX_CONVERT + 1}`;
  }
  private convert(p: FieldPair, value: unknown): { value: unknown } | { error: string } {
    const { before: b, after: a } = p as { before: CustomField; after: CustomField };
    if ([a.type, b.type].some((t) => t === 'file' || t === 'ref')) return { error: 'Links and files cannot be converted' };
    const choice = (v: unknown) => b.choices?.find((c) => c.value === v)?.label ?? v;
    const text = b.type === 'select' ? choice(value) : b.type === 'multi' ? (value as unknown[]).map(choice) : value;
    if (b.type === 'money' && a.type !== 'money') return a.type === 'number' ? { value: Number(value) / 100 } : coerceValue(a, String(Number(value) / 100));
    if (a.type === 'money' && b.type !== 'money') { const n = Number(String(text).replace(/,/g, '')); return Number.isFinite(n) && String(text).trim() !== '' ? coerceValue(a, Math.round(n * 100)) : { error: 'Not an amount' }; }
    const r = coerceValue({ ...a, min: undefined, max: undefined }, text);
    return 'value' in r && isEmpty(r.value) ? { error: 'Would be lost' } : r;
  }
  private async changes(db: any, before: Definition, after: Definition): Promise<Change[]> {
    const out: Change[] = [];
    const where = (e: string) => { const t = tableOf(e); return t ? after.tables.find((x) => x.key === t)?.title ?? t : entityTitle(e); };
    for (const p of changedFields(before, after)) {
      const at = `${where(p.entity)} > ${p.label}`;
      const { before: b, after: a } = p;
      if (!b) { out.push({ where: at, message: `New ${a!.type} field${a!.required ? ', required on new records' : ''}` }); continue; }
      if (!a) continue;
      const n = await this.count(db, p.entity, p.key);
      if (b.type !== a.type || b.ref !== a.ref) {
        const rows = await this.holders(db, p.entity, p.key);
        const bad = rows.length > MAX_CONVERT ? rows.length : rows.filter((r) => b.type === a.type || 'error' in this.convert(p, r.data[p.key])).length;
        out.push({ where: at, records: rows.length, blocked: bad > 0, message: bad ? (rows.length > MAX_CONVERT ? `Too many records to convert from ${b.type} to ${a.type}` : `${bad} of ${rows.length} values cannot become ${a.type === b.type ? 'the new link' : a.type}. Fix or clear them first.`) : `Type changes from ${b.type} to ${a.type}` });
      }
      if (!b.archived && a.archived) out.push({ where: at, records: n, message: 'Archived: hidden, data kept' });
      if (b.archived && !a.archived) out.push({ where: at, records: n, message: 'Restored' });
      if (!b.required && a.required) out.push({ where: at, message: 'Required on new records. Existing records may stay empty until edited.' });
      if (!b.unique && a.unique) {
        const seen = new Set<string>();
        const rows = await this.holders(db, p.entity, p.key);
        const twice = rows.some((r) => { const v = JSON.stringify(r.data[p.key]); if (seen.has(v)) return true; seen.add(v); return false; });
        out.push({ where: at, blocked: twice, message: twice ? 'Two records already share a value, so it cannot be unique' : 'Values must now be unique' });
      }
      if (b.label !== a.label) out.push({ where: at, message: `Renamed from "${b.label}"` });
      if (b.personal && !a.personal) out.push({ where: at, records: n, message: 'No longer treated as personal data' });
      const gone = (a.choices ?? []).filter((c) => c.archived && b.choices?.some((x) => x.value === c.value && !x.archived));
      if (gone.length) out.push({ where: at, message: `Choices no longer offered: ${gone.map((c) => c.label).join(', ')}` });
    }
    for (const t of after.tables) {
      const b = before.tables.find((x) => x.key === t.key);
      const n = b ? await db.customRecord.count({ where: { tableKey: t.key, deletedAt: null } }) : 0;
      if (!b) out.push({ where: t.title, message: 'New table' });
      else if (!b.archived && t.archived) out.push({ where: t.title, records: n, message: 'Table archived: hidden, data kept' });
      else if (b.archived && !t.archived) out.push({ where: t.title, records: n, message: 'Table restored' });
      if (b && JSON.stringify(b.access) !== JSON.stringify(t.access)) out.push({ where: t.title, records: n, message: 'Who may use this table changes' });
    }
    for (const e of Object.keys(after.entities)) if (JSON.stringify(before.entities[e]?.layout ?? {}) !== JSON.stringify(after.entities[e].layout ?? {})) out.push({ where: entityTitle(e), message: 'Screen layout changes' });
    for (const [name, b, a] of [['Form', before.forms, after.forms], ['Rule', before.rules, after.rules]] as [string, Row[], Row[]][]) {
      for (const x of a) { const y = b.find((z) => z.key === x.key); if (!y) out.push({ where: `${name}: ${x.title ?? x.name}`, message: 'New' }); else if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ where: `${name}: ${x.title ?? x.name}`, message: 'Changed' }); }
      for (const y of b) if (!a.some((x) => x.key === y.key)) out.push({ where: `${name}: ${y.title ?? y.name}`, message: 'Removed' });
    }
    return out;
  }
  /** Makes the draft live. Converts stored values where a type changed, or refuses without changing anything. */
  async publish(note?: string, rev?: number) {
    const tenantId = requireTenant().id;
    const r = await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`structure:${tenantId}`}))`;
      const draft = await tx.structureVersion.findFirst({ where: { status: 'DRAFT' } });
      if (!draft) throw new BadRequestException('There is nothing to publish');
      if (rev !== undefined && draft.rev !== rev) throw new ConflictException({ code: 'STALE', message: 'Someone else changed this draft. Reload to see their version.' });
      const before = await this.load(tx);
      const after = keepRemoved(before, draft.definition as Definition);
      await this.limits(after, tx);
      const problems = checkDefinition(after);
      if (problems.length) throw new UnprocessableEntityException({ code: 'STRUCTURE', message: 'Fix these before publishing', details: problems.map((p) => ({ path: p.where, message: p.message })) });
      const blocked = (await this.changes(tx, before, after)).filter((c) => c.blocked);
      if (blocked.length) throw new UnprocessableEntityException({ code: 'STRUCTURE', message: 'These changes would lose data', details: blocked.map((p) => ({ path: p.where, message: p.message })) });
      let converted = 0;
      for (const p of changedFields(before, after)) {
        if (!p.before || !p.after || p.before.type === p.after.type) continue;
        for (const h of await this.holders(tx, p.entity, p.key)) {
          const v = this.convert(p, h.data[p.key]) as { value: unknown };
          const data = { data: json({ ...h.data, [p.key]: v.value }) };
          if (tableOf(p.entity)) await tx.customRecord.update({ where: { id: h.id }, data }); else await tx.customValue.update({ where: { id: h.id }, data });
          converted++;
        }
      }
      const number = ((await tx.structureVersion.aggregate({ _max: { number: true } }))._max.number ?? 0) + 1;
      await tx.structureVersion.updateMany({ where: { status: 'PUBLISHED' }, data: { status: 'SUPERSEDED' } });
      await tx.structureVersion.update({ where: { id: draft.id }, data: { status: 'PUBLISHED', number, definition: json(after), note, publishedAt: new Date(), createdById: getCtx()?.user?.id, reviewNote: null, ...(draft.submittedAt ? {} : { submittedById: null, submitNote: null }) } });
      return { number, converted, submittedById: draft.submittedAt ? (draft.submittedById as string | null) : null };
    }, { timeout: 120_000, maxWait: 10_000 });
    await this.bust();
    await this.audit.log(r.submittedById ? 'APPROVE' : 'CONFIG_CHANGE', 'structure', String(r.number), undefined, { published: r.number, note, converted: r.converted, askedBy: r.submittedById });
    return r;
  }
  /** Copies an earlier version into the draft. Fields added since then are archived, not lost. */
  async restore(number: number) {
    const v = await this.prisma.structureVersion.findFirst({ where: { number } });
    if (!v) throw new NotFoundException('Version not found');
    const draft = await this.prisma.structureVersion.findFirst({ where: { status: 'DRAFT' } });
    const old = v.definition as unknown as Definition;
    // A field that was purged since must come back empty, and its definition alone is safe to restore.
    const r = await this.saveDraft(old, draft?.rev ?? 0);
    await this.audit.log('CONFIG_CHANGE', 'structure', String(number), undefined, { restoredToDraft: number });
    return r;
  }
  /** Permanently deletes an archived field or table and its data. */
  async purge(entity: string, key: string | null, confirm: string) {
    if (confirm !== (key ?? tableOf(entity))) throw new BadRequestException('Type the key to confirm');
    const tenantId = requireTenant().id;
    const t = tableOf(entity);
    const removed = await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`structure:${tenantId}`}))`;
      if (await tx.structureVersion.findFirst({ where: { status: 'DRAFT' } })) throw new BadRequestException('Publish or discard the draft first');
      const d = structuredClone(await this.load(tx));
      let n: number;
      if (key === null) {
        const table = d.tables.find((x) => x.key === t);
        if (!t || !table?.archived) throw new BadRequestException('Archive the table and publish first');
        const users = [...Object.values(d.entities), ...d.tables.filter((x) => x.key !== t)].flatMap((x) => x.fields).filter((f) => f.ref === entity);
        if (users.length) throw new BadRequestException(`Still linked from: ${users.map((f) => f.label).join(', ')}`);
        n = (await tx.customRecord.deleteMany({ where: { tableKey: t } })).count;
        d.tables = d.tables.filter((x) => x.key !== t);
        d.forms = d.forms.filter((f) => f.table !== t);
        d.rules = d.rules.filter((r) => r.entity !== entity);
      } else {
        const list = t ? d.tables.find((x) => x.key === t)?.fields : d.entities[entity]?.fields;
        const i = list?.findIndex((f) => f.key === key && f.archived) ?? -1;
        if (i < 0) throw new BadRequestException('Archive the field and publish first');
        n = t
          ? await tx.$executeRaw`UPDATE custom_records SET data = data - ${key}::text, "updatedAt" = now() WHERE "tenantId" = ${tenantId} AND "tableKey" = ${t} AND jsonb_exists(data, ${key})`
          : await tx.$executeRaw`UPDATE custom_values SET data = data - ${key}::text, "updatedAt" = now() WHERE "tenantId" = ${tenantId} AND entity = ${entity} AND jsonb_exists(data, ${key})`;
        list!.splice(i, 1);
      }
      const number = ((await tx.structureVersion.aggregate({ _max: { number: true } }))._max.number ?? 0) + 1;
      await tx.structureVersion.updateMany({ where: { status: 'PUBLISHED' }, data: { status: 'SUPERSEDED' } });
      await tx.structureVersion.create({ data: { number, status: 'PUBLISHED', definition: json(d), note: `Permanently deleted ${entity}${key ? `.${key}` : ''}`, publishedAt: new Date(), createdById: getCtx()?.user?.id } });
      return n;
    }, { timeout: 120_000 });
    await this.bust();
    await this.audit.log('DELETE', 'structure', `${entity}${key ? `.${key}` : ''}`, undefined, { purged: true, records: removed });
    return { removed };
  }
  /** Everything stored for one field, archived or not, for a copy before deletion. */
  async exportField(entity: string, key: string) {
    const d = await this.load(this.prisma);
    if (!this.fieldsOf(d, entity).some((f) => f.key === key)) throw new NotFoundException('Field not found');
    const tenantId = requireTenant().id;
    const t = tableOf(entity);
    const rows = t
      ? await this.prisma.$queryRaw<Row[]>`SELECT id AS record, data->>${key} AS value FROM custom_records WHERE "tenantId" = ${tenantId} AND "tableKey" = ${t} AND jsonb_exists(data, ${key})`
      : await this.prisma.$queryRaw<Row[]>`SELECT "recordId" AS record, data->>${key} AS value FROM custom_values WHERE "tenantId" = ${tenantId} AND entity = ${entity} AND jsonb_exists(data, ${key})`;
    await this.audit.log('EXPORT', 'structure', `${entity}.${key}`, undefined, { rows: rows.length });
    return rows;
  }
  /** Adds a template to this NGO's draft, and publishes it only if nothing else was waiting. */
  async useTemplate(tpl: Definition, publish: boolean, note: string) {
    const draft = await this.prisma.structureVersion.findFirst({ where: { status: 'DRAFT' } });
    const base = draft ? (draft.definition as unknown as Definition) : await this.load(this.prisma);
    const { definition, skipped } = applyTemplate(base, tpl);
    const saved = await this.saveDraft(definition, draft?.rev ?? 0);
    if (!publish) return { status: 'DRAFT', skipped };
    if (draft) return { status: 'DRAFT', skipped, message: 'Added to the unpublished draft, which needs review' };
    await this.publish(note, saved.rev);
    return { status: 'PUBLISHED', skipped };
  }
  /** Gives a new NGO the platform's starting structure. Never stops the sign-up. */
  async useDefault() {
    const t = await runAsSystem(() => this.prisma.structureTemplate.findFirst({ where: { isDefault: true } }));
    if (t) await this.useTemplate(t.definition as unknown as Definition, true, `Template: ${t.name}`);
  }
}

@Global()
@Module({ providers: [StructureService], exports: [StructureService] })
export class StructureCoreModule {}
