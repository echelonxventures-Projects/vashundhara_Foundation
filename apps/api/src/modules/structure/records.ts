import { BadRequestException, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { CustomField, CustomTable, Definition } from '@vashundhara-foundation/shared';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant } from '../../common/context/context';
import { toCsv } from '../../common/crud/csv';
import { Can, PageQuery, Paging, Public, RateLimit, ZBody, ZQuery } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { likeText, StructureService } from '../../common/structure/structure.service';

type Row = Record<string, any>;
const Body = z.record(z.string().max(40), z.unknown());
const titleOf = (t: CustomTable, data: Row): string => {
  const f = t.fields.find((x) => !x.archived && !['ref', 'file', 'bool', 'multi'].includes(x.type) && data[x.key] !== undefined) as CustomField | undefined;
  if (!f) return 'Record';
  const v = data[f.key];
  return String(f.type === 'select' ? f.choices?.find((c) => c.value === v)?.label ?? v : f.type === 'money' ? v / 100 : v).slice(0, 200);
};
const flat = (r: Row, t: CustomTable, s: StructureService) => ({ custom: s.show(t.fields, r.data), id: r.id, title: r.title, source: r.source, createdAt: r.createdAt, updatedAt: r.updatedAt });

/** Rows in an NGO's own tables. The permission is the floor; each table also names the roles that may use it. */
@ApiTags('records')
@Controller('records/:table')
export class RecordsController {
  constructor(private readonly prisma: PrismaService, private readonly structure: StructureService, private readonly audit: AuditService) {}
  private async query(t: CustomTable, q: Row, page: Paging) {
    const parts = [Prisma.sql`"tenantId" = ${requireTenant().id}`, Prisma.sql`"tableKey" = ${t.key}`, Prisma.sql`"deletedAt" IS NULL`, ...this.structure.conditions(t.fields, q)];
    if (page.q) {
      const like = likeText(page.q);
      parts.push(Prisma.sql`(${Prisma.join([Prisma.sql`title ILIKE ${like}`, ...t.fields.filter((f) => f.search && !f.archived).map((f) => Prisma.sql`data->>${f.key} ILIKE ${like}`)], ' OR ')})`);
    }
    const where = Prisma.join(parts, ' AND ');
    const f = t.fields.find((x) => !x.archived && x.key === page.sort?.replace(/^-/, ''));
    const dir = page.sort?.startsWith('-') ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const order = !f ? Prisma.sql`"createdAt" DESC, id` : f.type === 'number' || f.type === 'money' ? Prisma.sql`(data->>${f.key})::numeric ${dir} NULLS LAST, id` : Prisma.sql`data->>${f.key} ${dir} NULLS LAST, id`;
    return { where, order };
  }
  @Get() @Can('records:read')
  async list(@Param('table') key: string, @ZQuery(PageQuery) page: Paging, @Query() q: Row) {
    const t = await this.structure.table(key, 'read');
    const { where, order } = await this.query(t, q, page);
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM custom_records WHERE ${where} ORDER BY ${order} LIMIT ${page.limit} OFFSET ${(page.page - 1) * page.limit}`;
    const [{ n }] = await this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM custom_records WHERE ${where}`;
    const rows = await this.prisma.customRecord.findMany({ where: { id: { in: ids.map((x) => x.id) } } });
    const items = ids.flatMap((x) => rows.filter((r) => r.id === x.id)).map((r) => flat(r, t, this.structure));
    return { items, total: n, page: page.page, limit: page.limit, refs: await this.structure.refLabels(await this.structure.published(), t.fields, items.map((i) => i.custom)) };
  }
  @Get('export') @Can('records:export')
  async export(@Param('table') key: string, @Query() q: Row) {
    const t = await this.structure.table(key, 'read');
    const { where } = await this.query(t, q, { page: 1, limit: 100 });
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM custom_records WHERE ${where} ORDER BY "createdAt" LIMIT 20001`;
    if (ids.length > 20_000) throw new BadRequestException('Too many rows. Filter the list first.');
    const rows = await this.prisma.customRecord.findMany({ where: { id: { in: ids.map((x) => x.id) } }, orderBy: { createdAt: 'asc' } });
    const fields = t.fields.filter((f) => !f.archived);
    const refs = await this.structure.refLabels(await this.structure.published(), fields, rows.map((r) => r.data as Row));
    const cell = (f: CustomField, v: any) => (v === undefined ? '' : f.type === 'ref' ? refs[v] : f.type === 'money' ? v / 100 : f.type === 'select' ? f.choices?.find((c) => c.value === v)?.label ?? v : f.type === 'multi' ? v.map((x: string) => f.choices?.find((c) => c.value === x)?.label ?? x).join(', ') : v);
    const heads = fields.map((f) => f.label.replace(/[",\r\n]/g, ' '));
    await this.audit.log('EXPORT', `records.${key}`, undefined, undefined, { rows: rows.length });
    return { filename: `${key}.csv`, csv: toCsv(['Created', ...heads], rows.map((r) => ({ Created: r.createdAt, ...Object.fromEntries(fields.map((f, i) => [heads[i], cell(f, (r.data as Row)[f.key])])) }))) };
  }
  private async find(db: any, key: string, id: string): Promise<Row> {
    const r = await db.customRecord.findFirst({ where: { id, tableKey: key, deletedAt: null } });
    if (!r) throw new NotFoundException('Not found');
    return r;
  }
  @Get(':id') @Can('records:read')
  async get(@Param('table') key: string, @Param('id') id: string) {
    const t = await this.structure.table(key, 'read');
    return flat(await this.find(this.prisma, key, id), t, this.structure);
  }
  @Post() @Can('records:create')
  async create(@Param('table') key: string, @ZBody(Body) b: Row) {
    const r = await this.prisma.$transaction(async (tx: any) => {
      const d = await this.structure.locked(tx);
      return this.insert(tx, d, this.structure.pick(d, key, 'create'), b, 'STAFF');
    });
    const t = await this.structure.table(key, 'create');
    await this.audit.log('CREATE', `records.${key}`, r.id, undefined, this.structure.forAudit(t.fields, r.data as Row));
    return flat(r, t, this.structure);
  }
  private async insert(tx: any, d: Definition, t: CustomTable, input: Row, source: string): Promise<Row> {
    const data = await this.structure.clean(tx, `x:${t.key}`, t.fields, input, {}, null);
    const r = await tx.customRecord.create({ data: { tableKey: t.key, title: titleOf(t, data), data, source, createdById: getCtx()?.user?.id ?? null } });
    await this.structure.queueRules(tx, d, `x:${t.key}`, r.id, 'CREATED', Object.keys(data));
    return r;
  }
  @Put(':id') @Can('records:update')
  async update(@Param('table') key: string, @Param('id') id: string, @ZBody(Body) b: Row) {
    const { t, old, r } = await this.prisma.$transaction(async (tx: any) => {
      const d = await this.structure.locked(tx);
      const t = this.structure.pick(d, key, 'update');
      await tx.$executeRaw`SELECT 1 FROM custom_records WHERE id = ${id} AND "tenantId" = ${requireTenant().id} FOR UPDATE`;
      const old = await this.find(tx, key, id);
      const data = await this.structure.clean(tx, `x:${key}`, t.fields, b, old.data, id);
      const r = await tx.customRecord.update({ where: { id }, data: { data, title: titleOf(t, data) } });
      await this.structure.queueRules(tx, d, `x:${key}`, id, 'UPDATED', Object.keys({ ...old.data, ...data }).filter((k) => JSON.stringify(old.data[k]) !== JSON.stringify(data[k])));
      return { t, old, r };
    });
    await this.audit.log('UPDATE', `records.${key}`, id, this.structure.forAudit(t.fields, old.data), this.structure.forAudit(t.fields, r.data));
    return flat(r, t, this.structure);
  }
  @Delete(':id') @Can('records:delete')
  async remove(@Param('table') key: string, @Param('id') id: string) {
    await this.structure.table(key, 'delete');
    await this.find(this.prisma, key, id);
    await this.prisma.customRecord.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log('DELETE', `records.${key}`, id);
    return { ok: true };
  }
}

/** Extra fields on donations. The amount, status and receipt are not reachable from here. */
@ApiTags('donations')
@Controller('donation-details/:id')
export class DonationDetailsController {
  constructor(private readonly prisma: PrismaService, private readonly structure: StructureService, private readonly audit: AuditService) {}
  @Get() @Can('donations:read')
  async get(@Param('id') id: string) {
    if (!(await this.prisma.donation.findFirst({ where: { id }, select: { id: true } }))) throw new NotFoundException('Not found');
    const fields = (await this.structure.published()).entities.donations?.fields ?? [];
    return { id, custom: this.structure.show(fields, (await this.structure.valuesFor('donations', [id])).get(id) ?? {}) };
  }
  @Put() @Can('donations:update')
  async update(@Param('id') id: string, @ZBody(z.object({ custom: Body }).strict()) b: { custom: Row }) {
    if (!(await this.prisma.donation.findFirst({ where: { id }, select: { id: true } }))) throw new NotFoundException('Not found');
    const x = await this.prisma.$transaction((tx: any) => this.structure.saveValues(tx, 'donations', id, b.custom, false));
    await this.audit.log('UPDATE', 'donationDetails', id, undefined, this.structure.forAudit((await this.structure.published()).entities.donations?.fields ?? [], x.data));
    return { id, custom: x.data };
  }
}

const Submit = z.object({ values: Body, consent: z.boolean().optional(), website: z.string().max(200).optional() }).strict();
/** Forms built by the NGO. A public form can only add a row to its one table, and never read any. */
@ApiTags('forms')
@Controller('public/forms/:key')
export class FormsController {
  constructor(private readonly prisma: PrismaService, private readonly structure: StructureService) {}
  private async form(db: any, key: string) {
    const d = db ? await this.structure.locked(db) : await this.structure.published();
    const f = d.forms.find((x) => x.key === key && x.active);
    const t = f && d.tables.find((x) => x.key === f.table && !x.archived);
    if (!f || !t) throw new NotFoundException('Form not found');
    if (f.access === 'MEMBERS' && !getCtx()?.user) throw new UnauthorizedException('Please sign in');
    const fields = f.fields.flatMap((x) => t.fields.filter((y) => y.key === x.key && !y.archived && !['file', 'ref'].includes(y.type)).map((y) => ({ ...y, required: y.required || x.required })));
    return { d, f, t, fields, consent: fields.some((x) => x.personal || x.type === 'email' || x.type === 'phone') };
  }
  @Get() @Public()
  async get(@Param('key') key: string) {
    const { f, fields, consent } = await this.form(null, key);
    return { title: f.title, intro: f.intro ?? null, success: f.success ?? null, consent, fields: fields.map((x) => ({ key: x.key, label: x.label, type: x.type, hint: x.hint, required: x.required, min: x.min, max: x.max, choices: x.choices?.filter((c) => !c.archived).map((c) => ({ value: c.value, label: c.label })) })) };
  }
  @Post() @Public() @RateLimit(20, 3600) @HttpCode(200)
  async submit(@Param('key') key: string, @ZBody(Submit) b: z.infer<typeof Submit>) {
    // A filled trap field means a robot. It is told nothing.
    if (b.website) return { ok: true };
    await this.prisma.$transaction(async (tx: any) => {
      const { d, t, fields, consent, f } = await this.form(tx, key);
      if (consent && b.consent !== true) throw new BadRequestException({ code: 'CONSENT', message: 'Please agree before sending' });
      // Only the fields on this form count: others on the table can be neither set nor required.
      const data = await this.structure.clean(tx, `x:${t.key}`, fields, b.values, {}, null);
      const r = await tx.customRecord.create({ data: { tableKey: t.key, title: titleOf(t, data), data, source: 'FORM', createdById: getCtx()?.user?.id ?? null } });
      if (consent) {
        const email = fields.find((x) => x.type === 'email' && data[x.key]);
        await tx.consentRecord.create({ data: { tenantId: requireTenant().id, userId: getCtx()?.user?.id ?? null, email: email ? data[email.key] : null, purpose: `form:${f.key}`, version: '1', granted: true, ipAddress: getCtx()?.ip } });
      }
      await this.structure.queueRules(tx, d, `x:${t.key}`, r.id, 'CREATED', Object.keys(data));
    });
    return { ok: true };
  }
}
