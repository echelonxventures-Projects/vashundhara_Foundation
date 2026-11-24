import { BadRequestException, Controller, ForbiddenException, Get, HttpCode, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AidType, BeneficiaryStatus, CaseStatus, Gender, GrantStatus, InvoiceStatus, PublishStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { crudController } from '../../common/crud/crud';
import { Can, RateLimit, SelfService, ZBody } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.module';
import { VolunteersModule } from './volunteers';

const id = z.string().max(60);
const text = (n: number) => z.string().trim().min(1).max(n);
const opt = (n: number) => z.string().trim().max(n).nullish();
const address = z.record(z.string().max(30), z.string().max(200)).nullish();
const money = z.number().int().min(0).max(1_000_000_000_000);

const Person = z.object({ fullName: text(120), guardianName: opt(120), phone: opt(20), dateOfBirth: z.coerce.date().nullish(), gender: z.enum(Gender).nullish(), address, need: opt(3000) });
const Beneficiaries = crudController({
  path: 'beneficiaries', resource: 'beneficiaries', model: 'beneficiary', search: ['fullName', 'phone'], filters: ['status'], sort: ['fullName'],
  schema: Person.extend({ email: z.email().nullish(), idLast4: z.string().regex(/^\d{4}$/).nullish(), notes: opt(3000), consentAt: z.coerce.date().nullish(), consentVersion: opt(20) }),
  prepare: (d, { existing }) => {
    if (!existing && !d.consentAt) throw new BadRequestException({ code: 'CONSENT_REQUIRED', message: 'Record consent before saving personal details' });
    return d;
  }
});
const Cases = crudController({
  path: 'cases', resource: 'cases', model: 'beneficiaryCase', search: ['title'], filters: ['status', 'beneficiaryId', 'assignedToId'], sort: ['priority'], include: { beneficiary: { select: { id: true, fullName: true } } },
  schema: z.object({ beneficiaryId: id, title: text(150), description: opt(5000), status: z.enum(CaseStatus).optional(), priority: z.number().int().min(0).max(5).optional(), assignedToId: id.nullish() }),
  prepare: async (d, { prisma, existing }) => {
    if (d.assignedToId && !(await prisma.membership.findFirst({ where: { userId: d.assignedToId } }))) throw new BadRequestException('Assign the case to a member');
    if (d.status === 'CLOSED' && existing?.status !== 'CLOSED') return { ...d, closedAt: new Date() };
    return d.status && d.status !== 'CLOSED' ? { ...d, closedAt: null } : d;
  }
});
const Aid = crudController({
  path: 'aid', resource: 'aid', model: 'aidRecord', filters: ['type', 'beneficiaryId', 'grantId'], sort: ['givenAt'], include: { beneficiary: { select: { id: true, fullName: true } } },
  schema: z.object({ beneficiaryId: id, type: z.enum(AidType), description: text(1000), valueMinor: money.optional(), quantity: z.number().min(0).nullish(), unit: opt(20), givenAt: z.coerce.date(), grantId: id.nullish() }),
  prepare: async (d, { prisma, user, existing }) => {
    const beneficiaryId = d.beneficiaryId ?? existing?.beneficiaryId;
    const b = await prisma.beneficiary.findFirst({ where: { id: beneficiaryId, deletedAt: null } });
    if (!b || !['APPROVED', 'ACTIVE'].includes(b.status)) throw new BadRequestException('Approve the beneficiary before recording aid');
    return existing ? d : { ...d, givenById: user.id };
  }
});

const Apply = Person.extend({ consent: z.literal(true) });
const Decide = z.object({ status: z.enum(BeneficiaryStatus), note: opt(500) });
@ApiTags('beneficiaries')
@Controller('beneficiary-services')
export class BeneficiaryController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notify: NotificationsService) {}
  @Get('me') @SelfService()
  async me() {
    return { items: await this.prisma.beneficiary.findMany({ where: { userId: requireUser().id, deletedAt: null }, select: { id: true, fullName: true, status: true, need: true, createdAt: true, decidedAt: true, cases: { where: { deletedAt: null }, select: { id: true, title: true, status: true } }, aidRecords: { where: { deletedAt: null }, orderBy: { givenAt: 'desc' }, select: { id: true, type: true, description: true, givenAt: true } } } }) };
  }
  @Post('apply') @SelfService() @RateLimit(5, 86_400)
  async apply(@ZBody(Apply) b: z.infer<typeof Apply>) {
    const u = requireUser();
    const { consent, ...data } = b;
    if (await this.prisma.beneficiary.findFirst({ where: { userId: u.id, status: 'APPLIED', deletedAt: null } })) throw new BadRequestException('You already have an application in review');
    const row = await this.prisma.beneficiary.create({ data: { ...data, address: data.address ?? undefined, tenantId: requireTenant().id, userId: u.id, email: u.email, consentAt: new Date(), consentVersion: '1' }, select: { id: true, status: true } });
    await this.prisma.consentRecord.create({ data: { tenantId: requireTenant().id, userId: u.id, email: u.email, purpose: 'beneficiary_application', version: '1', granted: consent, ipAddress: getCtx()?.ip } });
    await this.audit.log('CREATE', 'beneficiary', row.id);
    return row;
  }
  @Put(':id/decision') @Can('beneficiaries:update')
  async decide(@Param('id') bid: string, @ZBody(Decide) b: z.infer<typeof Decide>) {
    const row = await this.prisma.beneficiary.findFirst({ where: { id: bid, deletedAt: null } });
    if (!row) throw new NotFoundException('Beneficiary not found');
    const allowed: Record<string, string[]> = { APPLIED: ['APPROVED', 'REJECTED'], APPROVED: ['ACTIVE', 'EXITED'], ACTIVE: ['EXITED'], REJECTED: ['APPROVED'], EXITED: ['ACTIVE'] };
    if (!allowed[row.status].includes(b.status)) throw new BadRequestException(`Cannot move from ${row.status} to ${b.status}`);
    await this.prisma.beneficiary.update({ where: { id: bid }, data: { status: b.status, decidedById: requireUser().id, decidedAt: new Date() } });
    await this.audit.log('APPROVE', 'beneficiary', bid, { status: row.status }, b);
    if (row.email) await this.notify.send({ template: 'beneficiary.decision', to: row.email, userId: row.userId, vars: { name: row.fullName, status: b.status.toLowerCase() } });
    return { ok: true };
  }
}

const Geo = { latitude: z.number().min(-90).max(90).nullish(), longitude: z.number().min(-180).max(180).nullish() };
const Past = z.coerce.date().refine((d) => d.getTime() < Date.now() + 300_000, 'Date is in the future');
const Sync = z.object({
  visits: z.array(z.object({ clientId: z.uuid(), beneficiaryId: id.nullish(), purpose: text(200), notes: opt(3000), ...Geo, accuracyM: z.number().int().min(0).max(100_000).nullish(), photoFileIds: z.array(id).max(10).optional(), visitedAt: Past })).max(200).optional(),
  attendance: z.array(z.object({ clientId: z.uuid(), kind: z.enum(['IN', 'OUT']), ...Geo, recordedAt: Past })).max(200).optional()
});
@ApiTags('field')
@Controller('field')
export class FieldController {
  constructor(private readonly prisma: PrismaService) {}
  /** Offline devices upload in batches. Repeats are ignored by clientId; each bad row is reported on its own. */
  @Post('sync') @Can('field:create') @HttpCode(200)
  async sync(@ZBody(Sync) b: z.infer<typeof Sync>) {
    const base = { tenantId: requireTenant().id, workerId: requireUser().id };
    const accepted: string[] = [];
    const rejected: { clientId: string; message: string }[] = [];
    const save = async (clientId: string, fn: () => Promise<unknown>) => {
      try { await fn(); accepted.push(clientId); } catch { rejected.push({ clientId, message: 'A linked record is not available' }); }
    };
    for (const v of b.visits ?? []) await save(v.clientId, () => this.prisma.fieldVisit.createMany({ data: [{ ...v, ...base }], skipDuplicates: true }));
    for (const a of b.attendance ?? []) await save(a.clientId, () => this.prisma.fieldAttendance.createMany({ data: [{ ...a, ...base }], skipDuplicates: true }));
    return { accepted, rejected };
  }
  @Get('visits') @Can('field:read')
  async visits() { return { items: await this.prisma.fieldVisit.findMany({ orderBy: { visitedAt: 'desc' }, take: 200, include: { beneficiary: { select: { fullName: true } } } }) }; }
  @Get('attendance') @Can('field:read')
  async attendance() { return { items: await this.prisma.fieldAttendance.findMany({ orderBy: { recordedAt: 'desc' }, take: 200 }) }; }
}

const Grants = crudController({
  path: 'grants', resource: 'grants', model: 'grant', search: ['title'], filters: ['status', 'organizationId'], include: { organization: { select: { id: true, name: true } }, utilisations: { where: { deletedAt: null } } },
  schema: z.object({ organizationId: id, title: text(200), description: opt(5000), amountMinor: money, status: z.enum(GrantStatus).optional(), startsAt: z.coerce.date().nullish(), endsAt: z.coerce.date().nullish() })
});
const Utilisations = crudController({
  path: 'grant-utilisations', resource: 'grants', model: 'grantUtilisation', filters: ['grantId'], sort: ['spentAt'],
  schema: z.object({ grantId: id, amountMinor: money.min(1), category: text(60), description: text(1000), fileId: id.nullish(), spentAt: z.coerce.date() }),
  prepare: async (d, { prisma, existing }) => {
    const g = await prisma.grant.findFirst({ where: { id: d.grantId ?? existing?.grantId, deletedAt: null } });
    if (!g || !['ACTIVE', 'COMPLETED'].includes(g.status)) throw new BadRequestException('The grant is not active');
    const spent = await prisma.grantUtilisation.aggregate({ where: { grantId: g.id, deletedAt: null, ...(existing ? { id: { not: existing.id } } : {}) }, _sum: { amountMinor: true } });
    if ((spent._sum.amountMinor ?? 0n) + BigInt(d.amountMinor ?? existing?.amountMinor ?? 0) > g.amountMinor) throw new BadRequestException('That would exceed the grant');
    return d;
  }
});
const Invoices = crudController({
  path: 'invoices', resource: 'invoices', model: 'invoice', search: ['number'], filters: ['status', 'organizationId'], sort: ['dueAt'], include: { organization: { select: { name: true } } },
  schema: z.object({ organizationId: id, grantId: id.nullish(), number: text(40), amountMinor: money.min(1), status: z.enum(InvoiceStatus).optional(), dueAt: z.coerce.date().nullish(), notes: opt(1000) }),
  prepare: (d, { existing }) => {
    if (existing?.status === 'PAID') throw new BadRequestException('A paid invoice cannot be changed');
    if (d.status === 'PAID') throw new BadRequestException('Use "record payment" to mark an invoice paid');
    return d;
  }
});
@ApiTags('invoices')
@Controller('invoice-payments')
export class InvoicePaymentsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  /** Marks paid and posts the ledger together, exactly once. */
  @Post(':id') @Can('invoices:update', 'finance:manage') @HttpCode(200)
  async pay(@Param('id') iid: string) {
    await this.prisma.$transaction(async (tx) => {
      const i = await tx.invoice.findFirst({ where: { id: iid, deletedAt: null } });
      const { count } = await tx.invoice.updateMany({ where: { id: iid, deletedAt: null, status: { in: ['SENT', 'OVERDUE'] } }, data: { status: 'PAID', paidAt: new Date() } });
      if (!i || !count) throw new BadRequestException('Only a sent invoice can be paid');
      const common = { tenantId: i.tenantId, journalId: randomUUID(), grantId: i.grantId, narration: `Invoice ${i.number} paid` };
      await tx.ledgerEntry.createMany({ data: [{ ...common, account: 'BANK', debitMinor: i.amountMinor }, { ...common, account: 'GRANT_INCOME', creditMinor: i.amountMinor }] });
    });
    await this.audit.log('UPDATE', 'invoice', iid, undefined, { status: 'PAID' });
    return { ok: true };
  }
}
@ApiTags('csr')
@Controller('csr')
export class CsrPortalController {
  constructor(private readonly prisma: PrismaService) {}
  /** A CSR partner sees only the grants of the company their membership is linked to. */
  @Get('portal') @SelfService()
  async portal() {
    const u = requireUser();
    if (!u.organizationId || !getCtx()!.roles.includes('csr_partner')) throw new ForbiddenException('For CSR partners only');
    const [organization, grants, invoices] = await Promise.all([
      this.prisma.organization.findFirst({ where: { id: u.organizationId }, select: { name: true } }),
      this.prisma.grant.findMany({ where: { organizationId: u.organizationId, deletedAt: null, status: { not: 'PROPOSED' } }, include: { utilisations: { where: { deletedAt: null }, orderBy: { spentAt: 'desc' }, select: { id: true, amountMinor: true, category: true, description: true, spentAt: true } }, _count: { select: { aidRecords: true } } } }),
      this.prisma.invoice.findMany({ where: { organizationId: u.organizationId, deletedAt: null, status: { not: 'DRAFT' } }, select: { id: true, number: true, amountMinor: true, status: true, dueAt: true, paidAt: true } })
    ]);
    return { organization, invoices, grants: grants.map((g) => ({ ...g, spentMinor: g.utilisations.reduce((a, x) => a + x.amountMinor, 0n) })) };
  }
}

const Programmes = crudController({ path: 'programmes', resource: 'programmes', model: 'programme', search: ['name'], filters: ['status'], include: { indicators: { where: { deletedAt: null }, include: { readings: { orderBy: { recordedAt: 'desc' }, take: 12 } } } }, schema: z.object({ name: text(150), description: opt(3000), startsAt: z.coerce.date().nullish(), endsAt: z.coerce.date().nullish(), budgetMinor: money.optional(), status: z.enum(PublishStatus).optional() }) });
const Indicators = crudController({ path: 'indicators', resource: 'programmes', model: 'indicator', filters: ['programmeId'], schema: z.object({ programmeId: id, name: text(150), unit: text(30), baseline: z.number().optional(), target: z.number() }) });
const Readings = crudController({ path: 'indicator-readings', resource: 'programmes', model: 'indicatorReading', filters: ['indicatorId'], sort: ['recordedAt'], schema: z.object({ indicatorId: id, value: z.number(), note: opt(500), recordedAt: Past }), prepare: (d, { user, existing }) => (existing ? d : { ...d, recordedById: user.id }) });
@ApiTags('programmes')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @Can('programmes:read')
  async board() {
    const rows = await this.prisma.programme.findMany({ where: { deletedAt: null, status: 'PUBLISHED' }, include: { indicators: { where: { deletedAt: null }, include: { readings: { orderBy: { recordedAt: 'desc' }, take: 1 } } } } });
    return { items: rows.map((p) => ({ id: p.id, name: p.name, budgetMinor: p.budgetMinor, indicators: p.indicators.map((i) => {
      const latest = i.readings[0] ? Number(i.readings[0].value) : Number(i.baseline);
      const span = Number(i.target) - Number(i.baseline);
      return { id: i.id, name: i.name, unit: i.unit, baseline: Number(i.baseline), target: Number(i.target), latest, progress: span === 0 ? 100 : Math.round(((latest - Number(i.baseline)) / span) * 100), updatedAt: i.readings[0]?.recordedAt ?? null };
    }) })) };
  }
}

@Module({ imports: [VolunteersModule], controllers: [InvoicePaymentsController, BeneficiaryController, FieldController, CsrPortalController, MonitoringController, Beneficiaries, Cases, Aid, Grants, Utilisations, Invoices, Programmes, Indicators, Readings] })
export class ProgrammesModule {}
