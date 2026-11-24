import { BadRequestException, Controller, Get, HttpCode, Module, OnModuleInit, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { fiscalYear, fiscalYearRange } from '@vashundhara-foundation/shared';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { requireTenant, runAsTenant } from '../../common/context/context';
import { parseCsv, toCsv } from '../../common/crud/csv';
import { crudController } from '../../common/crud/crud';
import { TenantResolver } from '../../common/http/context.middleware';
import { Can, ZBody, ZQuery } from '../../common/http/decorators';
import { JobsService } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';
import { DonationsService } from '../fundraising/donations.service';
import { FundraisingModule } from '../fundraising/fundraising.module';
import { ReceiptsService } from '../fundraising/receipts';
import { NotificationsService } from '../notifications/notifications.module';

const Range = z.object({ from: z.coerce.date(), to: z.coerce.date() });
const Settle = z.object({ csv: z.string().min(1).max(2_000_000) });
const RAISED = { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] as ('COMPLETED' | 'PARTIALLY_REFUNDED')[] } };
const Z = (b: bigint | null | undefined) => b ?? 0n;

@ApiTags('finance')
@Controller('finance')
export class FinanceController {
  constructor(private readonly prisma: PrismaService, private readonly donations: DonationsService, private readonly receipts: ReceiptsService, private readonly audit: AuditService) {}

  @Get('trial-balance') @Can('finance:read')
  async trialBalance(@ZQuery(Range) r: z.infer<typeof Range>) {
    const rows = await this.prisma.ledgerEntry.groupBy({ by: ['fund', 'account'], where: { occurredAt: { gte: r.from, lt: r.to } }, _sum: { debitMinor: true, creditMinor: true } });
    const items = rows.map((x) => ({ fund: x.fund, account: x.account, debitMinor: Z(x._sum.debitMinor), creditMinor: Z(x._sum.creditMinor) }));
    const diff = items.reduce((a, x) => a + x.debitMinor - x.creditMinor, 0n);
    return { items, balanced: diff === 0n };
  }
  @Get('ledger/export') @Can('finance:export')
  async ledger(@ZQuery(Range) r: z.infer<typeof Range>) {
    const rows = await this.prisma.ledgerEntry.findMany({ where: { occurredAt: { gte: r.from, lt: r.to } }, orderBy: [{ occurredAt: 'asc' }, { journalId: 'asc' }], take: 100_000 });
    await this.audit.log('EXPORT', 'ledger', null, undefined, r);
    return { filename: 'ledger.csv', csv: toCsv(['occurredAt', 'journalId', 'fund', 'account', 'debit', 'credit', 'narration', 'donationId', 'grantId'], rows.map((x) => ({ ...x, debit: Number(x.debitMinor) / 100, credit: Number(x.creditMinor) / 100 }))) };
  }
  /** Captured by the gateway but not yet seen in the bank. */
  @Get('unsettled') @Can('finance:read')
  async unsettled() {
    const where: Prisma.PaymentWhereInput = { status: { in: ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, settledAt: null, provider: { not: 'OFFLINE' } };
    const [items, total, sum] = await Promise.all([this.prisma.payment.findMany({ where, orderBy: { createdAt: 'asc' }, take: 100, include: { donation: { select: { donor: { select: { fullName: true } } } } } }), this.prisma.payment.count({ where }), this.prisma.payment.aggregate({ where, _sum: { amountMinor: true } })]);
    return { items, total, amountMinor: Z(sum._sum.amountMinor) };
  }
  /** Columns: payment_id, fee (rupees), settlement_id, settled_on (YYYY-MM-DD). Safe to upload twice. */
  @Post('settlements') @Can('finance:manage') @HttpCode(200)
  async settle(@ZBody(Settle) b: { csv: string }) {
    const rows = parseCsv(b.csv).map((r, i) => {
      const fee = /^\d+(\.\d{1,2})?$/.test(r.fee ?? '') ? Math.round(Number(r.fee) * 100) : NaN;
      const settledAt = /^\d{4}-\d{2}-\d{2}$/.test(r.settled_on ?? '') ? new Date(`${r.settled_on}T00:00:00+05:30`) : new Date(NaN);
      if (!r.payment_id || !r.settlement_id || Number.isNaN(fee) || Number.isNaN(settledAt.getTime())) throw new BadRequestException(`Row ${i + 2} is not valid`);
      return { paymentId: r.payment_id, feeMinor: fee, settlementRef: r.settlement_id, settledAt };
    });
    return this.donations.settle(rows);
  }
  /** Working file for Form 10BD. Only donations with an issued 80G receipt are listed. */
  @Get('form-10bd') @Can('finance:export')
  async form10bd(@Query('fy') fy = fiscalYear(new Date())) {
    let range: { start: Date; end: Date };
    try { range = fiscalYearRange(fy); } catch { throw new BadRequestException('Use a year like 2026-27'); }
    const tenantId = requireTenant().id;
    const compliance = await this.prisma.complianceProfile.findFirst();
    const base = { ...RAISED, fund: 'DOMESTIC' as const, completedAt: { gte: range.start, lt: range.end } };
    const rows = await this.prisma.donation.findMany({ where: { ...base, receipts: { some: { status: 'ISSUED', kind: 'SECTION_80G' } } }, include: { donor: true, campaign: true, receipts: { where: { status: 'ISSUED' } } }, orderBy: { completedAt: 'asc' } });
    const excluded = await this.prisma.donation.count({ where: { ...base, NOT: { receipts: { some: { status: 'ISSUED', kind: 'SECTION_80G' } } } } });
    await this.audit.log('EXPORT', 'form10bd', fy, undefined, { rows: rows.length });
    const mode = (m: string) => (m === 'CASH' ? 'Cash' : m === 'IN_KIND' ? 'Kind' : 'Electronic modes including account payee cheque/draft');
    return {
      filename: `form-10bd-${fy}.csv`, included: rows.length, excluded,
      csv: toCsv(['Sl. No.', 'Pre Acknowledgement Number', 'ID Code', 'Unique Identification Number', 'Section Code', 'Unique Registration Number (URN)', 'Date of Issuance of URN', 'Name of donor', 'Address of donor', 'Donation Type', 'Mode of receipt', 'Amount of donation (INR)'], rows.map((r, i) => ({
        'Sl. No.': i + 1, 'Pre Acknowledgement Number': '', 'ID Code': 'Permanent Account Number', 'Unique Identification Number': r.donor.panEnc ? this.receipts.cipher.decrypt(r.donor.panEnc, `pan:${tenantId}`) : '',
        'Section Code': 'Section 80G', 'Unique Registration Number (URN)': compliance?.reg80G ?? '', 'Date of Issuance of URN': compliance?.reg80GValidFrom?.toISOString().slice(0, 10) ?? '', 'Name of donor': r.donor.fullName,
        'Address of donor': r.donor.address ? Object.values(r.donor.address as object).join(', ') : '', 'Donation Type': 'Others', 'Mode of receipt': mode(r.method), 'Amount of donation (INR)': Number(r.amountMinor - r.refundedMinor) / 100
      })))
    };
  }
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService, private readonly notify: NotificationsService, private readonly tenants: TenantResolver) {}
  onModuleInit() { this.jobs.every(900, 'reports.tick', () => this.tick()); }

  @Get('dashboard') @Can('reports:read')
  async dashboard() {
    const now = new Date();
    const month = new Date(now.getTime() - 30 * 86400_000);
    const prev = new Date(now.getTime() - 60 * 86400_000);
    const sum = (gte?: Date, lt?: Date) => this.prisma.donation.aggregate({ where: { ...RAISED, ...(gte ? { completedAt: { gte, lt } } : {}) }, _sum: { amountMinor: true, refundedMinor: true }, _count: true });
    const net = (a: Awaited<ReturnType<typeof sum>>) => Z(a._sum.amountMinor) - Z(a._sum.refundedMinor);
    const [all, cur, old, donors, campaigns, volunteers, beneficiaries, students, recent, byCampaign] = await Promise.all([
      sum(), sum(month), sum(prev, month), this.prisma.donor.count({ where: { deletedAt: null, donations: { some: RAISED } } }), this.prisma.campaign.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.volunteer.count({ where: { status: 'ACTIVE', deletedAt: null } }), this.prisma.beneficiary.count({ where: { status: { in: ['APPROVED', 'ACTIVE'] }, deletedAt: null } }), this.prisma.student.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.donation.findMany({ where: RAISED, orderBy: { completedAt: 'desc' }, take: 8, select: { id: true, amountMinor: true, currency: true, completedAt: true, donor: { select: { fullName: true } }, campaign: { select: { title: true } } } }),
      this.prisma.donation.groupBy({ by: ['campaignId'], where: { ...RAISED, campaignId: { not: null } }, _sum: { amountMinor: true }, orderBy: { _sum: { amountMinor: 'desc' } }, take: 5 })
    ]);
    const titles = new Map((await this.prisma.campaign.findMany({ where: { id: { in: byCampaign.map((c) => c.campaignId!) } }, select: { id: true, title: true, goalMinor: true } })).map((c) => [c.id, c]));
    return { raisedMinor: net(all), last30Minor: net(cur), previous30Minor: net(old), donations: all._count, donors, campaigns, volunteers, beneficiaries, students, recent, topCampaigns: byCampaign.map((c) => ({ title: titles.get(c.campaignId!)?.title, goalMinor: titles.get(c.campaignId!)?.goalMinor, raisedMinor: Z(c._sum.amountMinor) })) };
  }
  @Get('monthly') @Can('reports:read')
  async monthly() {
    const tenantId = requireTenant().id;
    const rows = await this.prisma.$queryRaw<{ month: string; amount: bigint; count: bigint }[]>`
      SELECT to_char("completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month, sum("amountMinor" - "refundedMinor")::bigint AS amount, count(*)::bigint AS count
      FROM donations WHERE "tenantId" = ${tenantId} AND status IN ('COMPLETED', 'PARTIALLY_REFUNDED') AND "completedAt" > now() - interval '13 months' GROUP BY 1 ORDER BY 1`;
    return { items: rows.map((r) => ({ month: r.month, amountMinor: r.amount, count: r.count })) };
  }
  private async tick() {
    const due = await this.prisma.reportSchedule.findMany({ where: { isActive: true, nextRunAt: { lte: new Date() } }, take: 100 });
    for (const s of due) {
      const days = s.frequency === 'DAILY' ? 1 : s.frequency === 'WEEKLY' ? 7 : 30;
      const { count } = await this.prisma.reportSchedule.updateMany({ where: { id: s.id, nextRunAt: s.nextRunAt }, data: { lastRunAt: new Date(), nextRunAt: new Date(Date.now() + days * 86400_000) } });
      const t = count ? await this.tenants.byId(s.tenantId) : null;
      if (!t) continue;
      await runAsTenant(t, async () => {
        for (const to of s.recipients) await this.notify.send({ template: 'report.ready', to, vars: { report: s.report, link: `${this.tenants.url(t)}/${t.defaultLocale}/staff/reports` } });
      });
    }
  }
}

const SchedulesController = crudController({ path: 'report-schedules', resource: 'reports', model: 'reportSchedule', only: ['list', 'get'], schema: z.object({}) });
const Schedule = z.object({ report: z.enum(['donations', 'finance', 'programmes']), frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']), recipients: z.array(z.email()).min(1).max(10) });
@ApiTags('reports')
@Controller('report-schedule')
export class ScheduleController {
  constructor(private readonly prisma: PrismaService) {}
  @Post() @Can('reports:manage')
  async create(@ZBody(Schedule) b: z.infer<typeof Schedule>) {
    const members = await this.prisma.membership.count({ where: { status: 'ACTIVE', user: { email: { in: b.recipients, mode: 'insensitive' } } } });
    if (members !== new Set(b.recipients).size) throw new BadRequestException('Reports can only go to members of your organisation');
    return this.prisma.reportSchedule.create({ data: { ...b, tenantId: requireTenant().id, nextRunAt: new Date() } });
  }
}

@Module({ imports: [FundraisingModule], controllers: [FinanceController, ReportsController, SchedulesController, ScheduleController] })
export class FinanceModule {}
