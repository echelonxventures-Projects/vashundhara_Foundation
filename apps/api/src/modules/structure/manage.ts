import { BadRequestException, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, Injectable, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Definition, hasPermission, RECORDS, TABLE_ACTIONS, tableAllows } from '@vashundhara-foundation/shared';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser, runAsSystem, runAsTenant } from '../../common/context/context';
import { toCsv } from '../../common/crud/csv';
import { TenantResolver } from '../../common/http/context.middleware';
import { Can, PlatformAdmin, RateLimit, SelfService, ZBody } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { StructureService } from '../../common/structure/structure.service';
import { ENV, Env } from '../../env';
import { NotificationsService } from '../notifications/notifications.module';
import { DefinitionSchema } from './schema';

const Draft = z.object({ definition: DefinitionSchema, rev: z.number().int().min(0) }).strict();
const Publish = z.object({ rev: z.number().int().min(1), note: z.string().trim().max(300).optional() }).strict();
const Purge = z.object({ entity: z.string().max(60), key: z.string().max(60).nullable(), confirm: z.string().max(60) }).strict();
const Submit = z.object({ rev: z.number().int().min(1), note: z.string().trim().max(300).optional() }).strict();
const Back = z.object({ rev: z.number().int().min(1), note: z.string().trim().min(5).max(500) }).strict();
const Policy = z.object({ ngoAdminAllowed: z.boolean(), ngoAdminPublish: z.boolean(), maxFields: z.number().int().min(0).max(1000), maxTables: z.number().int().min(0).max(100), maxForms: z.number().int().min(0).max(100), maxRules: z.number().int().min(0).max(100) }).partial().strict();
const Template = z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(500).optional(), fromTenantId: z.uuid().optional(), definition: DefinitionSchema.optional(), isDefault: z.boolean().optional() }).strict();
const Apply = z.object({ tenantIds: z.union([z.literal('ALL'), z.array(z.uuid()).min(1).max(500)]), publish: z.boolean() }).strict();
type Z<T extends z.ZodType> = z.infer<T>;
const csv = (rows: Record<string, unknown>[], name: string) => ({ filename: `${name.replace(/[^a-z0-9_-]+/gi, '-')}.csv`, csv: toCsv(['record', 'value'], rows) });

/** An NGO Administrator may manage the structure only while Super Admin permits this NGO. */
@Injectable()
export class StructureGate {
  constructor(private readonly structure: StructureService, @Inject(ENV) private readonly env: Env) {}
  async allowed(): Promise<boolean> {
    const c = getCtx()!;
    if (!c.sessionId) return false;
    // Same rule as the platform console.
    if (c.user?.isSystemAdmin) return c.user.mfaEnabled || this.env.NODE_ENV !== 'production';
    return c.roles.includes('tenant_admin') && (await this.structure.policy()).ngoAdminAllowed;
  }
  /** Super Admin approves every publish, unless direct publishing is on for this NGO. */
  async mayPublish(): Promise<boolean> {
    return (await this.allowed()) && (Boolean(getCtx()!.user?.isSystemAdmin) || (await this.structure.policy()).ngoAdminPublish);
  }
  async check() {
    if (!(await this.allowed())) throw new ForbiddenException({ code: 'NOT_PERMITTED', message: 'Super Admin has not permitted this organisation to change its structure' });
  }
}

@ApiTags('structure')
@Controller('structure')
export class StructureController {
  constructor(private readonly structure: StructureService, private readonly gate: StructureGate, private readonly prisma: PrismaService, private readonly notify: NotificationsService) {}
  /** What this person needs to draw their screens: only records and tables they may read. */
  @Get() @SelfService()
  async mine() {
    const c = getCtx()!;
    if (!c.permissions.size) return { entities: {}, tables: [], canManage: false };
    const d = await this.structure.published();
    const can = (p: string) => hasPermission(c.permissions, p);
    return {
      entities: Object.fromEntries(Object.entries(d.entities).filter(([e]) => can(e === 'donations' ? 'donations:read' : `${RECORDS[e]?.resource}:read`)).map(([e, s]) => [e, { ...s, fields: s.fields.filter((f) => !f.archived) }])),
      tables: d.tables.filter((t) => !t.archived && can('records:read') && tableAllows(t, 'read', c.roles)).map(({ access: _a, ...t }) => ({ ...t, fields: t.fields.filter((f) => !f.archived), can: TABLE_ACTIONS.filter((a) => can(`records:${a}`) && tableAllows(d.tables.find((x) => x.key === t.key)!, a, c.roles)) })),
      forms: can('records:read') ? d.forms.filter((f) => f.active).map((f) => ({ key: f.key, title: f.title, table: f.table })) : [],
      canManage: can('structure:update') && (await this.gate.allowed())
    };
  }
  @Get('manage') @Can('structure:read')
  async overview() { await this.gate.check(); return { ...(await this.structure.overview()), canPublish: await this.gate.mayPublish() }; }
  @Put('manage/draft') @Can('structure:update')
  async save(@ZBody(Draft) b: Z<typeof Draft>) { await this.gate.check(); return this.structure.saveDraft(b.definition as Definition, b.rev); }
  @Delete('manage/draft') @Can('structure:update')
  async discard() { await this.gate.check(); return this.structure.discard(); }
  @Get('manage/preview') @Can('structure:read')
  async preview() { await this.gate.check(); return this.structure.preview(); }
  @Post('manage/publish') @Can('structure:update') @HttpCode(200)
  async publish(@ZBody(Publish) b: Z<typeof Publish>) {
    await this.gate.check();
    if (!(await this.gate.mayPublish())) throw new ForbiddenException({ code: 'NEEDS_APPROVAL', message: 'Super Admin approves each publish for this organisation. Send the draft for review.' });
    const { submittedById: _s, ...r } = await this.structure.publish(b.note, b.rev);
    return r;
  }
  @Post('manage/submit') @Can('structure:update') @HttpCode(200) @RateLimit(20, 3600)
  async submit(@ZBody(Submit) b: Z<typeof Submit>) {
    await this.gate.check();
    const r = await this.structure.submit(b.rev, b.note);
    const u = requireUser();
    const roots = await runAsSystem(() => this.prisma.user.findMany({ where: { isSystemAdmin: true, status: 'ACTIVE', deletedAt: null }, select: { id: true, email: true }, take: 20 }));
    for (const x of roots) await this.notify.send({ template: 'structure.submitted', to: x.email, userId: x.id, vars: { name: `${u.firstName} ${u.lastName}`, note: b.note ?? '' } });
    return r;
  }
  @Delete('manage/submit') @Can('structure:update')
  async withdraw() { await this.gate.check(); return this.structure.withdraw(); }
  @Post('manage/restore/:number') @Can('structure:update') @HttpCode(200)
  async restore(@Param('number') n: string) { await this.gate.check(); return this.structure.restore(whole(n)); }
  @Get('manage/export') @Can('structure:read', 'records:export')
  async export(@Query('entity') entity: string, @Query('key') key: string) { await this.gate.check(); return csv(await this.structure.exportField(String(entity), String(key)), `${entity}-${key}`); }
}
const whole = (n: string) => { if (!/^\d{1,9}$/.test(n)) throw new BadRequestException('Not a version'); return Number(n); };

/** Super Admin: any NGO's structure, who may manage it, and shared templates. */
@ApiTags('platform')
@Controller('platform/structure')
@PlatformAdmin()
export class PlatformStructureController {
  constructor(private readonly structure: StructureService, private readonly prisma: PrismaService, private readonly tenants: TenantResolver, private readonly audit: AuditService, private readonly notify: NotificationsService) {}
  private async in<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const t = await this.tenants.byId(id);
    if (!t) throw new NotFoundException('NGO not found');
    return runAsTenant(t, fn);
  }
  @Get('ngos/:id/manage')
  overview(@Param('id') id: string) { return this.in(id, async () => ({ ...(await this.structure.overview()), canPublish: true, name: requireTenant().name })); }
  @Put('ngos/:id/manage/draft')
  save(@Param('id') id: string, @ZBody(Draft) b: Z<typeof Draft>) { return this.in(id, () => this.structure.saveDraft(b.definition as Definition, b.rev)); }
  @Delete('ngos/:id/manage/draft')
  discard(@Param('id') id: string) { return this.in(id, () => this.structure.discard()); }
  @Get('ngos/:id/manage/preview')
  preview(@Param('id') id: string) { return this.in(id, () => this.structure.preview()); }
  @Post('ngos/:id/manage/publish') @HttpCode(200)
  publish(@Param('id') id: string, @ZBody(Publish) b: Z<typeof Publish>) {
    return this.in(id, async () => {
      const { submittedById, ...r } = await this.structure.publish(b.note, b.rev);
      if (submittedById) await this.tell(submittedById, 'structure.approved', { number: r.number, note: b.note ?? '' });
      return r;
    });
  }
  @Post('ngos/:id/manage/return') @HttpCode(200)
  sendBack(@Param('id') id: string, @ZBody(Back) b: Z<typeof Back>) {
    return this.in(id, async () => {
      const { submittedById } = await this.structure.sendBack(b.rev, b.note);
      const t = requireTenant();
      if (submittedById) await this.tell(submittedById, 'structure.returned', { note: b.note, link: `${this.tenants.url(t)}/${t.defaultLocale}/staff/structure` });
      return { ok: true };
    });
  }
  /** Tells the person who asked, by email and in their notifications. */
  private async tell(userId: string, template: string, vars: Record<string, unknown>) {
    const u = await runAsSystem(() => this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE', deletedAt: null }, select: { id: true, email: true } }));
    if (!u) return;
    for (const channel of ['EMAIL', 'IN_APP'] as const) await this.notify.send({ template, channel, to: u.email, userId: u.id, vars });
  }
  /** Drafts waiting for a decision, oldest first. */
  @Get('reviews')
  async reviews() {
    const rows = await runAsSystem(() => this.prisma.structureVersion.findMany({ where: { status: 'DRAFT', submittedAt: { not: null }, tenant: { deletedAt: null } }, orderBy: { submittedAt: 'asc' }, take: 200, select: { id: true, rev: true, submittedAt: true, submitNote: true, submittedById: true, tenant: { select: { id: true, name: true } } } }));
    const users = await runAsSystem(() => this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.submittedById).filter((x): x is string => Boolean(x)) } }, select: { id: true, email: true } }));
    return { items: rows.map(({ submittedById, ...r }) => ({ ...r, by: users.find((u) => u.id === submittedById)?.email ?? null })) };
  }
  @Post('ngos/:id/manage/restore/:number') @HttpCode(200)
  restore(@Param('id') id: string, @Param('number') n: string) { return this.in(id, () => this.structure.restore(whole(n))); }
  @Get('ngos/:id/manage/export')
  export(@Param('id') id: string, @Query('entity') entity: string, @Query('key') key: string) { return this.in(id, async () => csv(await this.structure.exportField(String(entity), String(key)), `${entity}-${key}`)); }
  @Post('ngos/:id/manage/purge') @HttpCode(200)
  purge(@Param('id') id: string, @ZBody(Purge) b: Z<typeof Purge>) { return this.in(id, () => this.structure.purge(b.entity, b.key, b.confirm)); }
  @Put('ngos/:id/policy')
  policy(@Param('id') id: string, @ZBody(Policy) b: Z<typeof Policy>) {
    return this.in(id, async () => {
      const tenantId = requireTenant().id;
      const before = await this.structure.policy();
      const p = await this.prisma.structurePolicy.upsert({ where: { tenantId }, create: { ...b, tenantId }, update: b });
      await this.audit.log('PERMISSION_CHANGE', 'structurePolicy', tenantId, before, p);
      return p;
    });
  }

  @Get('templates')
  async templates() { return { items: await runAsSystem(() => this.prisma.structureTemplate.findMany({ orderBy: { name: 'asc' } })) }; }
  @Post('templates')
  async create(@ZBody(Template) b: Z<typeof Template>) {
    const definition = b.fromTenantId ? await this.in(b.fromTenantId, () => this.structure.published()) : b.definition;
    if (!definition) throw new BadRequestException('Choose an NGO to copy from');
    return this.store(null, b, definition as Definition);
  }
  @Put('templates/:id')
  async update(@Param('id') id: string, @ZBody(Template.partial()) b: Partial<Z<typeof Template>>) { return this.store(id, b, b.fromTenantId ? await this.in(b.fromTenantId, () => this.structure.published()) : (b.definition as Definition | undefined)); }
  private async store(id: string | null, b: Partial<Z<typeof Template>>, definition?: Definition) {
    const t = await runAsSystem(() => this.prisma.$transaction(async (tx) => {
      if (id && !(await tx.structureTemplate.findUnique({ where: { id } }))) throw new NotFoundException('Template not found');
      if (b.isDefault) await tx.structureTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      const data = { name: b.name, description: b.description, isDefault: b.isDefault, definition: definition as never };
      return id ? tx.structureTemplate.update({ where: { id }, data }) : tx.structureTemplate.create({ data: { ...data, name: b.name!, createdById: requireUser().id } });
    }));
    await this.audit.log(id ? 'UPDATE' : 'CREATE', 'structureTemplate', t.id, undefined, { name: t.name, isDefault: t.isDefault }, { tenantId: null });
    return t;
  }
  @Delete('templates/:id')
  async remove(@Param('id') id: string) {
    const { count } = await runAsSystem(() => this.prisma.structureTemplate.deleteMany({ where: { id } }));
    if (!count) throw new NotFoundException('Template not found');
    await this.audit.log('DELETE', 'structureTemplate', id, undefined, undefined, { tenantId: null });
    return { ok: true };
  }
  /** Adds a template to one, several or all NGOs. One NGO's problem never stops the others. */
  @Post('templates/:id/apply') @HttpCode(200)
  async apply(@Param('id') id: string, @ZBody(Apply) b: Z<typeof Apply>) {
    const t = await runAsSystem(() => this.prisma.structureTemplate.findUnique({ where: { id } }));
    if (!t) throw new NotFoundException('Template not found');
    const list = await runAsSystem(() => this.prisma.tenant.findMany({ where: { deletedAt: null, ...(b.tenantIds === 'ALL' ? { status: { not: 'ARCHIVED' } } : { id: { in: b.tenantIds } }) }, select: { id: true, name: true } }));
    const results: { id: string; name: string; status: string; skipped?: string[]; message?: string }[] = [];
    for (const n of list) {
      try { results.push({ id: n.id, name: n.name, ...(await this.in(n.id, () => this.structure.useTemplate(t.definition as unknown as Definition, b.publish, `Template: ${t.name}`))) }); } catch (e) {
        const r = (e as { getResponse?: () => { message?: string; details?: { path: string; message: string }[] } }).getResponse?.();
        if (!r) throw e;
        results.push({ id: n.id, name: n.name, status: 'FAILED', message: [r.message, ...(r.details ?? []).map((x) => `${x.path}: ${x.message}`)].join('. ') });
      }
    }
    await this.audit.log('CONFIG_CHANGE', 'structureTemplate', id, undefined, { publish: b.publish, results: results.map((r) => ({ id: r.id, status: r.status })) }, { tenantId: null });
    return { results };
  }
}
