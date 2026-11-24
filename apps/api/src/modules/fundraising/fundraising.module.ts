import { BadRequestException, Controller, Get, Headers, HttpCode, Inject, Module, NotFoundException, Param, Post, Put, Query, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CampaignStatus, PaymentMethod, Prisma, SubscriptionInterval } from '@prisma/client';
import { randomToken } from '@vashundhara-foundation/auth';
import { PAN_REGEX } from '@vashundhara-foundation/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { ENV, Env } from '../../env';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { parseCsv, toCsv } from '../../common/crud/csv';
import { crudController } from '../../common/crud/crud';
import { Can, PageQuery, Paging, Public, RateLimit, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { Email, Slug } from '../auth/auth.module';
import { SystemModule } from '../system/system.module';
import { DonationsService } from './donations.service';
import { GatewayService, mockPayments } from './gateway';
import { ReceiptsController, ReceiptsService } from './receipts';

const Pan = z.string().trim().toUpperCase().regex(PAN_REGEX, 'PAN is not valid');
const Amount = z.number().int().min(100).max(100_000_000_00);
const Address = z.record(z.string().max(30), z.string().max(200)).optional();
const DonorIn = z.object({ fullName: z.string().trim().min(2).max(120), email: Email, phone: z.string().regex(/^\+?[0-9 -]{7,16}$/).optional(), pan: Pan.optional(), address: Address, isIndianCitizen: z.boolean(), marketingConsent: z.boolean().optional() });
const Give = z.object({ amountMinor: Amount, campaignSlug: z.string().max(60).optional(), donor: DonorIn, isAnonymous: z.boolean().optional(), wants80G: z.boolean().optional(), message: z.string().max(500).optional(), interval: z.enum(SubscriptionInterval).optional() });
const Confirm = z.object({ token: z.string().max(100), paymentId: z.string().max(60), signature: z.string().max(200) });
const SubConfirm = z.object({ paymentId: z.string().max(60), signature: z.string().max(200) });

const MockPay = z.object({ orderId: z.string().max(60).optional(), subscriptionId: z.string().max(60).optional(), amountMinor: Amount });
const RAISED = { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] as ('COMPLETED' | 'PARTIALLY_REFUNDED')[] } };

@ApiTags('public')
@Controller('public')
export class PublicGivingController {
  constructor(private readonly prisma: PrismaService, private readonly donations: DonationsService) {}

  private async totals(ids: string[]) {
    const g = await this.prisma.donation.groupBy({ by: ['campaignId'], where: { campaignId: { in: ids }, ...RAISED }, _sum: { amountMinor: true, refundedMinor: true }, _count: true });
    return new Map(g.map((x) => [x.campaignId, { raisedMinor: (x._sum.amountMinor ?? 0n) - (x._sum.refundedMinor ?? 0n), donations: x._count }]));
  }
  @Get('campaigns') @Public()
  async campaigns(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.CampaignWhereInput = { status: { in: ['ACTIVE', 'COMPLETED'] }, deletedAt: null, ...(p.q ? { title: { contains: p.q, mode: 'insensitive' } } : {}) };
    const [rows, total] = await Promise.all([this.prisma.campaign.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], skip: (p.page - 1) * p.limit, take: p.limit, omit: { story: true } }), this.prisma.campaign.count({ where })]);
    const t = await this.totals(rows.map((r) => r.id));
    return { items: rows.map((r) => ({ ...r, ...(t.get(r.id) ?? { raisedMinor: 0, donations: 0 }) })), total, page: p.page, limit: p.limit };
  }
  @Get('campaigns/:slug') @Public()
  async campaign(@Param('slug') slug: string) {
    const c = await this.prisma.campaign.findFirst({ where: { slug, status: { in: ['ACTIVE', 'COMPLETED', 'PAUSED'] }, deletedAt: null } });
    if (!c) throw new NotFoundException('Campaign not found');
    const t = await this.totals([c.id]);
    const recent = await this.prisma.donation.findMany({ where: { campaignId: c.id, ...RAISED }, orderBy: { completedAt: 'desc' }, take: 10, select: { isAnonymous: true, amountMinor: true, completedAt: true, message: true, donor: { select: { fullName: true } } } });
    return { ...c, ...(t.get(c.id) ?? { raisedMinor: 0, donations: 0 }), recent: recent.map((r) => ({ name: r.isAnonymous ? null : r.donor.fullName.split(' ')[0], amountMinor: r.isAnonymous ? null : r.amountMinor, at: r.completedAt, message: r.isAnonymous ? null : r.message })) };
  }
  @Post('donations') @Public() @HttpCode(200) @RateLimit(20, 600)
  give(@ZBody(Give) b: z.infer<typeof Give>) { return this.donations.start(b); }
  @Post('donations/:id/confirm') @Public() @HttpCode(200) @RateLimit(30, 600)
  confirm(@Param('id') id: string, @ZBody(Confirm) b: z.infer<typeof Confirm>) { return this.donations.confirm(id, b); }
  @Get('donations/:id') @Public() @RateLimit(120, 600)
  status(@Param('id') id: string, @Query('token') token: string) { return this.donations.status(id, token); }
  @Post('subscriptions/:id/confirm') @Public() @HttpCode(200) @RateLimit(30, 600)
  confirmSub(@Param('id') id: string, @ZBody(SubConfirm) b: z.infer<typeof SubConfirm>) { return this.donations.confirmSubscription(id, b); }
}

@ApiTags('payments')
@Controller('payments')
export class PaymentWebhooksController {
  constructor(private readonly donations: DonationsService) {}
  // The context middleware selects the NGO from this path's slug before the signature is checked.
  @Post(':provider/webhook/:slug') @Public() @HttpCode(200) @RateLimit(3000, 60)
  receive(@Param('provider') provider: string, @Param('slug') slug: string, @Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string, @Headers('x-razorpay-event-id') eventId: string) {
    const code = provider === 'razorpay' ? 'RAZORPAY' : provider === 'mock' ? 'MOCK' : null;
    if (!code || !req.rawBody || !signature || !eventId) throw new BadRequestException('Not a valid webhook');
    if (getCtx()?.tenant?.slug !== slug) throw new NotFoundException('Unknown organisation');
    return this.donations.receive(code, req.rawBody, signature, eventId);
  }
}

/** Stands in for the payment popup in development and automated tests. Refuses to exist in production. */
@Controller('dev')
export class MockPayController {
  constructor(private readonly prisma: PrismaService, private readonly gateways: GatewayService, @Inject(ENV) private readonly env: Env) {}
  @Post('mock-pay') @Public() @HttpCode(200)
  async pay(@ZBody(MockPay) b: z.infer<typeof MockPay>) {
    if (this.env.NODE_ENV === 'production') throw new NotFoundException();
    const g = await this.gateways.byProvider('MOCK', 'DOMESTIC');
    const paymentId = `pay_${randomToken(9)}`;
    mockPayments.set(paymentId, { id: paymentId, orderId: b.orderId ?? null, amountMinor: b.amountMinor, currency: 'INR', status: 'captured', feeMinor: 0 });
    const signature = (g as unknown as { sign(v: string): string }).sign(b.orderId ? `${b.orderId}|${paymentId}` : `${paymentId}|${b.subscriptionId}`);
    return { paymentId, signature };
  }
}

const CampaignsController = crudController({
  path: 'campaigns', resource: 'campaigns', model: 'campaign', search: ['title', 'slug'], filters: ['status'], sort: ['title', 'endsAt'],
  schema: z.object({ slug: Slug, title: z.string().min(3).max(150), summary: z.string().max(300).nullish(), story: z.string().max(50_000).nullish(), coverFileId: z.string().max(60).nullish(), goalMinor: z.number().int().min(0), suggestedAmounts: z.array(z.number().int().min(100).max(1_000_000_000)).max(6).optional(), status: z.enum(CampaignStatus).optional(), is80GEligible: z.boolean().optional(), startsAt: z.coerce.date().nullish(), endsAt: z.coerce.date().nullish() }),
  prepare: async (d, { existing, prisma }) => {
    const start = d.startsAt ?? existing?.startsAt;
    const end = d.endsAt ?? existing?.endsAt;
    if (start && end && new Date(end) <= new Date(start)) throw new BadRequestException('The end date must be after the start date');
    if (d.coverFileId && !(await prisma.file.findFirst({ where: { id: d.coverFileId, isPublic: true } }))) throw new BadRequestException('Choose a public image');
    return d;
  }
});

const DonorSchema = z.object({ type: z.enum(['INDIVIDUAL', 'CORPORATE', 'TRUST']).optional(), fullName: z.string().min(2).max(120), email: Email.nullish(), phone: z.string().max(20).nullish(), pan: Pan.nullish(), address: z.record(z.string().max(30), z.string().max(200)).nullish(), isIndianCitizen: z.boolean().nullish(), marketingConsent: z.boolean().optional(), notes: z.string().max(2000).nullish(), tags: z.array(z.string().max(30)).max(20).optional(), organizationId: z.string().max(60).nullish() });
let receiptsRef: ReceiptsService | undefined;
const encryptPan = (d: Record<string, any>) => {
  const { pan, ...rest } = d;
  if (pan === undefined) return rest;
  if (pan === null) return { ...rest, panEnc: null, panLast4: null };
  return { ...rest, panEnc: receiptsRef!.cipher.encrypt(pan, `pan:${requireTenant().id}`), panLast4: pan.slice(-4) };
};
const DonorsController = crudController({
  path: 'donors', resource: 'donors', model: 'donor', search: ['fullName', 'email', 'phone'], filters: ['type', 'tags'], sort: ['fullName'], omit: { panEnc: true }, schema: DonorSchema,
  prepare: (d) => encryptPan(d)
});

const ImportSchema = z.object({ csv: z.string().min(1).max(2_000_000) });
@ApiTags('donors')
@Controller('donor-tools')
export class DonorToolsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, receipts: ReceiptsService) { receiptsRef = receipts; }
  @Get('export') @Can('donors:export')
  async export() {
    const rows = await this.prisma.donor.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50_000, omit: { panEnc: true } });
    await this.audit.log('EXPORT', 'donor', null, undefined, { rows: rows.length });
    return { filename: 'donors.csv', csv: toCsv(['fullName', 'email', 'phone', 'type', 'panLast4', 'isIndianCitizen', 'marketingConsent', 'createdAt'], rows) };
  }
  /** Columns: fullName, email, phone, pan, isIndianCitizen. Valid rows are saved; bad rows are reported. */
  @Post('import') @Can('donors:import') @HttpCode(200)
  async import(@ZBody(ImportSchema) b: { csv: string }) {
    const tenantId = requireTenant().id;
    const errors: { row: number; message: string }[] = [];
    let created = 0;
    let skipped = 0;
    const rows = parseCsv(b.csv);
    if (rows.length > 5000) throw new BadRequestException('Import at most 5,000 rows at a time');
    for (const [i, r] of rows.entries()) {
      const v = DonorSchema.safeParse({ fullName: r.fullName, email: r.email || null, phone: r.phone || null, pan: r.pan || null, isIndianCitizen: r.isIndianCitizen ? /^(true|yes|y|1)$/i.test(r.isIndianCitizen) : null });
      if (!v.success) { errors.push({ row: i + 2, message: v.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') }); continue; }
      if (v.data.email && (await this.prisma.donor.findFirst({ where: { email: v.data.email, fullName: { equals: v.data.fullName, mode: 'insensitive' }, deletedAt: null } }))) { skipped++; continue; }
      await this.prisma.donor.create({ data: { ...(encryptPan(v.data) as Prisma.DonorUncheckedCreateInput), tenantId } });
      created++;
    }
    await this.audit.log('IMPORT', 'donor', null, undefined, { created, skipped, errors: errors.length });
    return { created, skipped, errors: errors.slice(0, 100) };
  }
}

const Offline = z.object({ amountMinor: Amount, method: z.enum(PaymentMethod), receivedAt: z.coerce.date(), reference: z.string().max(100).optional(), campaignId: z.string().max(60).optional(), donorId: z.string().max(60).optional(), donor: DonorIn.extend({ email: Email.optional() }).optional(), wants80G: z.boolean().optional(), isAnonymous: z.boolean().optional() });
const RefundIn = z.object({ amountMinor: z.number().int().min(100), reason: z.string().min(5).max(300) });
const DonationQuery = PageQuery.extend({ status: z.string().max(30).optional(), method: z.enum(PaymentMethod).optional(), campaignId: z.string().max(60).optional(), donorId: z.string().max(60).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() });

@ApiTags('donations')
@Controller('donations')
export class DonationsController {
  constructor(private readonly prisma: PrismaService, private readonly donations: DonationsService, private readonly audit: AuditService) {}
  private where(p: z.infer<typeof DonationQuery>): Prisma.DonationWhereInput {
    return {
      ...(p.status ? { status: p.status as never } : {}), ...(p.method ? { method: p.method } : {}), ...(p.campaignId ? { campaignId: p.campaignId } : {}), ...(p.donorId ? { donorId: p.donorId } : {}),
      ...(p.from || p.to ? { createdAt: { gte: p.from, lte: p.to } } : {}),
      ...(p.q ? { OR: [{ donor: { fullName: { contains: p.q, mode: 'insensitive' } } }, { donor: { email: { contains: p.q, mode: 'insensitive' } } }, { reference: { contains: p.q } }] } : {})
    };
  }
  @Get() @Can('donations:read')
  async list(@ZQuery(DonationQuery) p: z.infer<typeof DonationQuery>) {
    const where = this.where(p);
    const [items, total] = await Promise.all([
      this.prisma.donation.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { publicToken: true }, include: { donor: { select: { id: true, fullName: true, email: true } }, campaign: { select: { title: true } }, receipts: { where: { status: 'ISSUED' }, select: { id: true, number: true, kind: true } } } }),
      this.prisma.donation.count({ where })
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get('export') @Can('donations:export')
  async export(@ZQuery(DonationQuery) p: z.infer<typeof DonationQuery>) {
    const rows = await this.prisma.donation.findMany({ where: this.where(p), orderBy: { createdAt: 'desc' }, take: 50_000, include: { donor: true, campaign: true, receipts: { where: { status: 'ISSUED' } } } });
    await this.audit.log('EXPORT', 'donation', null, undefined, { rows: rows.length });
    return { filename: 'donations.csv', csv: toCsv(['date', 'donor', 'email', 'amount', 'refunded', 'currency', 'fund', 'method', 'status', 'campaign', 'receipt', 'reference'], rows.map((r) => ({ date: r.completedAt ?? r.createdAt, donor: r.donor.fullName, email: r.donor.email, amount: Number(r.amountMinor) / 100, refunded: Number(r.refundedMinor) / 100, currency: r.currency, fund: r.fund, method: r.method, status: r.status, campaign: r.campaign?.title, receipt: r.receipts[0]?.number, reference: r.reference }))) };
  }
  @Get(':id') @Can('donations:read')
  async get(@Param('id') id: string) {
    const d = await this.prisma.donation.findFirst({ where: { id }, omit: { publicToken: true }, include: { donor: { omit: { panEnc: true } }, campaign: true, payments: true, refunds: true, receipts: { omit: { snapshot: true } } } });
    if (!d) throw new NotFoundException('Donation not found');
    return d;
  }
  @Post() @Can('donations:create')
  offline(@ZBody(Offline) b: z.infer<typeof Offline>) { return this.donations.recordOffline(b as never); }
  @Post(':id/refunds') @Can('refunds:create')
  refund(@Param('id') id: string, @ZBody(RefundIn) b: z.infer<typeof RefundIn>) { return this.donations.requestRefund(id, b.amountMinor, b.reason); }
}

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly prisma: PrismaService, private readonly donations: DonationsService) {}
  @Get() @Can('subscriptions:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const [items, total] = await Promise.all([this.prisma.subscription.findMany({ orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, include: { donor: { select: { fullName: true, email: true } }, campaign: { select: { title: true } } } }), this.prisma.subscription.count()]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Put(':id/cancel') @Can('subscriptions:update')
  cancel(@Param('id') id: string) { return this.donations.cancelSubscription(id); }
}

@ApiTags('me')
@Controller('me/giving')
export class MyGivingController {
  constructor(private readonly prisma: PrismaService, private readonly donations: DonationsService) {}
  /** Gifts made before signing up are included once the email is verified. */
  private mine(): Prisma.DonorWhereInput {
    const u = requireUser();
    return { OR: [{ userId: u.id }, ...(u.emailVerified ? [{ userId: null, email: u.email }] : [])] };
  }
  @Get() @SelfService()
  async giving(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.DonationWhereInput = { donor: this.mine(), status: { notIn: ['CREATED', 'PENDING'] } };
    const [items, total, sum, subscriptions] = await Promise.all([
      this.prisma.donation.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, select: { id: true, amountMinor: true, refundedMinor: true, currency: true, status: true, completedAt: true, createdAt: true, campaign: { select: { title: true, slug: true } }, receipts: { where: { status: 'ISSUED' }, select: { id: true, number: true, kind: true } } } }),
      this.prisma.donation.count({ where }),
      this.prisma.donation.aggregate({ where: { donor: this.mine(), ...RAISED }, _sum: { amountMinor: true, refundedMinor: true } }),
      this.prisma.subscription.findMany({ where: { donor: this.mine(), status: { in: ['ACTIVE', 'PAUSED', 'CREATED'] } }, select: { id: true, amountMinor: true, currency: true, interval: true, status: true, nextChargeAt: true, campaign: { select: { title: true } } } })
    ]);
    return { items, total, page: p.page, limit: p.limit, totalMinor: (sum._sum.amountMinor ?? 0n) - (sum._sum.refundedMinor ?? 0n), subscriptions };
  }
  @Put('subscriptions/:id/cancel') @SelfService()
  cancel(@Param('id') id: string) { return this.donations.cancelSubscription(id, { userId: requireUser().id }); }
}

@Module({
  imports: [SystemModule],
  providers: [GatewayService, DonationsService, ReceiptsService],
  controllers: [...(process.env.NODE_ENV === 'production' ? [] : [MockPayController]), PublicGivingController, PaymentWebhooksController, CampaignsController, DonorsController, DonorToolsController, DonationsController, SubscriptionsController, MyGivingController, ReceiptsController],
  exports: [DonationsService, ReceiptsService, GatewayService]
})
export class FundraisingModule {}
