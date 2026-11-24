import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { Donation, Fund, PaymentMethod, PaymentProviderCode, Prisma, SubscriptionInterval } from '@prisma/client';
import { randomToken, safeEqual } from '@vashundhara-foundation/auth';
import { formatMinor, PAN_REGEX } from '@vashundhara-foundation/shared';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { TenantResolver } from '../../common/http/context.middleware';
import { JobsService } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.module';
import { WebhooksService } from '../system/webhooks';
import { Gateway, GatewayPayment, GatewayService } from './gateway';
import { ReceiptsService } from './receipts';

type Tx = Prisma.TransactionClient;
export interface DonorInput { fullName: string; email: string; phone?: string; pan?: string; address?: Record<string, string>; isIndianCitizen: boolean; marketingConsent?: boolean }
export interface GiveInput { amountMinor: number; campaignSlug?: string; donor: DonorInput; isAnonymous?: boolean; wants80G?: boolean; message?: string; interval?: SubscriptionInterval }

const PAID = ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'];

@Injectable()
export class DonationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService, private readonly gateways: GatewayService, private readonly receipts: ReceiptsService,
    private readonly notify: NotificationsService, private readonly hooks: WebhooksService, private readonly audit: AuditService,
    private readonly jobs: JobsService, private readonly tenants: TenantResolver
  ) {}
  onModuleInit() {
    this.jobs.register('payment.event', (p: { eventId: string }) => this.processEvent(p.eventId));
    this.jobs.register('refund.run', (p: { refundId: string }) => this.runRefund(p.refundId));
  }

  // ---------- starting a gift ----------

  private async fundFor(isIndianCitizen: boolean): Promise<Fund> {
    if (isIndianCitizen) return 'DOMESTIC';
    const c = await this.prisma.complianceProfile.findFirst();
    if (!c?.fcraVerifiedAt || !c.fcraValidUntil || c.fcraValidUntil < new Date()) {
      throw new UnprocessableEntityException({ code: 'FOREIGN_NOT_ACCEPTED', message: 'This organisation can only accept donations from Indian citizens' });
    }
    return 'FCRA';
  }
  private async assertCanRaise() {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: requireTenant().id } });
    if (t.status !== 'ACTIVE') throw new ForbiddenException({ code: 'NGO_NOT_ACTIVE', message: 'This organisation cannot accept donations yet' });
    if (t.defaultCurrency !== 'INR') throw new UnprocessableEntityException('Only INR donations are supported');
    return t;
  }
  private async campaign(slug?: string) {
    if (!slug) return null;
    const now = new Date();
    const c = await this.prisma.campaign.findFirst({ where: { slug, status: 'ACTIVE', deletedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }], AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }] } });
    if (!c) throw new NotFoundException('That campaign is not open for donations');
    return c;
  }

  /** Never edits an existing donor from a public form; an exact match is reused, otherwise a new record is made. */
  async donorFor(tx: Tx, d: DonorInput) {
    const tenantId = requireTenant().id;
    const me = getCtx()?.user;
    const email = d.email.toLowerCase();
    if (d.pan && !PAN_REGEX.test(d.pan)) throw new BadRequestException({ code: 'BAD_PAN', message: 'PAN is not valid' });
    const enc = d.pan ? { panEnc: this.receipts.cipher.encrypt(d.pan, `pan:${tenantId}`), panLast4: d.pan.slice(-4) } : {};
    const fresh = { fullName: d.fullName, email, phone: d.phone, address: d.address, isIndianCitizen: d.isIndianCitizen, marketingConsent: d.marketingConsent ?? false, ...enc };
    if (me && me.email.toLowerCase() === email) {
      const own = await tx.donor.findFirst({ where: { userId: me.id } });
      if (own) return tx.donor.update({ where: { id: own.id }, data: { ...fresh, phone: fresh.phone ?? own.phone, marketingConsent: d.marketingConsent ?? own.marketingConsent } });
      return tx.donor.create({ data: { tenantId, userId: me.id, ...fresh } });
    }
    const same = await tx.donor.findMany({ where: { userId: null, email, fullName: { equals: d.fullName, mode: 'insensitive' }, isIndianCitizen: d.isIndianCitizen, deletedAt: null }, take: 5 });
    const match = same.find((x) => (d.pan ? x.panEnc && this.receipts.cipher.decrypt(x.panEnc, `pan:${tenantId}`) === d.pan : !x.panEnc) && (x.phone ?? null) === (d.phone ?? null));
    return match ?? tx.donor.create({ data: { tenantId, ...fresh } });
  }

  async start(b: GiveInput) {
    const t = await this.assertCanRaise();
    const min = (t.settings as { minDonationMinor?: number }).minDonationMinor ?? 1000;
    if (b.amountMinor < min) throw new BadRequestException({ code: 'TOO_SMALL', message: `The smallest donation is ${formatMinor(min)}` });
    if (b.wants80G && !b.donor.pan) throw new BadRequestException({ code: 'PAN_REQUIRED', message: 'PAN is needed for an 80G receipt' });
    const campaign = await this.campaign(b.campaignSlug);
    const fund = await this.fundFor(b.donor.isIndianCitizen);
    const gateway = await this.gateways.active(fund);
    const publicToken = randomToken(32);
    const name = t.displayName ?? t.name;

    if (b.interval) {
      const providerSubscriptionId = await gateway.createSubscription(b.amountMinor, 'INR', b.interval, `${name} donation`);
      const sub = await this.prisma.$transaction(async (tx) => {
        const donor = await this.donorFor(tx, b.donor);
        return tx.subscription.create({ data: { tenantId: t.id, donorId: donor.id, campaignId: campaign?.id, amountMinor: b.amountMinor, interval: b.interval, provider: gateway.code, providerSubscriptionId, wants80G: b.wants80G ?? false } });
      });
      return { kind: 'subscription' as const, subscriptionId: sub.id, providerSubscriptionId, provider: gateway.code, keyId: gateway.keyId, amountMinor: b.amountMinor, name };
    }
    const orderId = await gateway.createOrder(b.amountMinor, 'INR', publicToken.slice(0, 20));
    const donation = await this.prisma.$transaction(async (tx) => {
      const donor = await this.donorFor(tx, b.donor);
      const d = await tx.donation.create({ data: { tenantId: t.id, donorId: donor.id, campaignId: campaign?.id, amountMinor: b.amountMinor, fund, status: 'PENDING', isAnonymous: b.isAnonymous ?? false, wants80G: b.wants80G ?? false, message: b.message, publicToken } });
      await tx.payment.create({ data: { tenantId: t.id, donationId: d.id, provider: gateway.code, providerOrderId: orderId, amountMinor: b.amountMinor } });
      return d;
    });
    return { kind: 'order' as const, donationId: donation.id, token: publicToken, orderId, provider: gateway.code, keyId: gateway.keyId, amountMinor: b.amountMinor, name };
  }

  // ---------- confirming a gift ----------

  /** The browser's word is never enough: signature first, then the amount is read back from the gateway. */
  async confirm(donationId: string, b: { token: string; paymentId: string; signature: string }) {
    const d = await this.prisma.donation.findFirst({ where: { id: donationId }, include: { payments: true } });
    if (!d || !safeEqual(d.publicToken, b.token)) throw new NotFoundException('Donation not found');
    const p = d.payments.find((x) => x.providerOrderId);
    if (!p) throw new BadRequestException('Nothing to confirm');
    const gateway = await this.gateways.byProvider(p.provider, d.fund);
    if (!gateway.verifyCheckout(p.providerOrderId!, b.paymentId, b.signature)) throw new BadRequestException({ code: 'BAD_SIGNATURE', message: 'The payment could not be verified' });
    const gp = await gateway.fetchPayment(b.paymentId);
    if (gp.orderId !== p.providerOrderId) throw new BadRequestException('Payment does not match this donation');
    if (gp.status === 'captured') await this.capture(p.provider, gp);
    return this.status(donationId, b.token);
  }
  async confirmSubscription(id: string, b: { paymentId: string; signature: string }) {
    const s = await this.prisma.subscription.findFirst({ where: { id } });
    if (!s?.providerSubscriptionId) throw new NotFoundException('Not found');
    const donor = await this.prisma.donor.findFirstOrThrow({ where: { id: s.donorId } });
    const gateway = await this.gateways.byProvider(s.provider, donor.isIndianCitizen === false ? 'FCRA' : 'DOMESTIC');
    if (!gateway.verifySubscription(s.providerSubscriptionId, b.paymentId, b.signature)) throw new BadRequestException({ code: 'BAD_SIGNATURE', message: 'The payment could not be verified' });
    // Money is recorded by the webhook; this only acknowledges the mandate.
    await this.prisma.subscription.updateMany({ where: { id, status: 'CREATED' }, data: { status: 'ACTIVE' } });
    return { status: 'ACTIVE' };
  }
  async status(donationId: string, token: string) {
    const d = await this.prisma.donation.findFirst({ where: { id: donationId }, include: { receipts: { where: { status: 'ISSUED' }, select: { number: true } } } });
    if (!d || !safeEqual(d.publicToken, String(token ?? ''))) throw new NotFoundException('Donation not found');
    return { status: d.status, amountMinor: d.amountMinor, currency: d.currency, receiptNumber: d.receipts[0]?.number ?? null };
  }

  /** Idempotent. Called by checkout, webhooks and reconciliation, possibly at the same time. */
  async capture(provider: PaymentProviderCode, gp: GatewayPayment) {
    if (!gp.orderId) return;
    const payment = await this.prisma.payment.findFirst({ where: { provider, providerOrderId: gp.orderId } });
    if (!payment) throw new NotFoundException('No donation for this payment');
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, payment.donationId);
      const p = await tx.payment.findFirstOrThrow({ where: { id: payment.id }, include: { donation: true } });
      if (p.status !== 'CREATED' && p.status !== 'FAILED') {
        if (p.providerPaymentId === gp.id) return;
        throw new ConflictException(`Order ${gp.orderId} was paid twice; refund ${gp.id} at the gateway`);
      }
      if (Number(p.amountMinor) !== gp.amountMinor || p.currency !== gp.currency) throw new ConflictException('Paid amount does not match the donation');
      await tx.payment.update({ where: { id: p.id }, data: { status: 'CAPTURED', providerPaymentId: gp.id, feeMinor: gp.feeMinor, error: null } });
      await this.complete(tx, p.donation);
    });
  }
  private async lock(tx: Tx, donationId: string) {
    await tx.$queryRaw`SELECT id FROM donations WHERE id = ${donationId} AND "tenantId" = ${requireTenant().id} FOR UPDATE`;
  }

  async complete(tx: Tx, d: Donation, completedAt = new Date()) {
    if (PAID.includes(d.status)) return;
    await tx.donation.update({ where: { id: d.id }, data: { status: 'COMPLETED', completedAt } });
    if (d.method !== 'IN_KIND') {
      const debit = d.method === 'CASH' ? 'CASH' : d.method === 'ONLINE' ? 'GATEWAY_CLEARING' : 'BANK';
      await this.journal(tx, d, [[debit, d.amountMinor, 0n], ['DONATION_INCOME', 0n, d.amountMinor]], 'Donation received', completedAt);
    }
    const receipt = await this.receipts.issue(tx, d.id);
    const donor = await tx.donor.findFirstOrThrow({ where: { id: d.donorId } });
    const t = requireTenant();
    if (donor.email) {
      await this.notify.send({
        template: 'donation.thanks', to: donor.email, userId: donor.userId, tx: tx as never,
        vars: { name: donor.fullName, amount: formatMinor(d.amountMinor, d.currency), receipt: receipt.number, link: `${this.tenants.url(t)}/api/receipts/public/${d.id}?token=${d.publicToken}` }
      });
    }
    await this.hooks.emit('DONATION_COMPLETED', { id: d.id, amountMinor: Number(d.amountMinor), currency: d.currency, campaignId: d.campaignId, receipt: receipt.number }, tx as never);
  }
  private async journal(tx: Tx, d: { id: string; fund: Fund }, lines: ['BANK' | 'GATEWAY_CLEARING' | 'GATEWAY_FEES' | 'CASH' | 'DONATION_INCOME' | 'REFUNDS', bigint, bigint][], narration: string, occurredAt = new Date()) {
    const sum = lines.reduce((a, [, dr, cr]) => a + dr - cr, 0n);
    if (sum !== 0n) throw new Error('Journal does not balance');
    const journalId = randomUUID();
    const tenantId = requireTenant().id;
    await tx.ledgerEntry.createMany({ data: lines.filter(([, dr, cr]) => dr || cr).map(([account, debitMinor, creditMinor]) => ({ tenantId, journalId, account, debitMinor, creditMinor, fund: d.fund, donationId: d.id, narration, occurredAt })) });
  }

  async recordOffline(b: { amountMinor: number; method: PaymentMethod; receivedAt: Date; reference?: string; campaignId?: string; donorId?: string; donor?: DonorInput; wants80G?: boolean; isAnonymous?: boolean }) {
    if (b.method === 'ONLINE') throw new BadRequestException('Online donations come from the gateway');
    if (b.receivedAt > new Date()) throw new BadRequestException('The date is in the future');
    const tenantId = requireTenant().id;
    const id = await this.prisma.$transaction(async (tx) => {
      const donor = b.donorId ? await tx.donor.findFirst({ where: { id: b.donorId, deletedAt: null } }) : b.donor ? await tx.donor.create({ data: await this.newDonor(b.donor) }) : null;
      if (!donor) throw new BadRequestException('Choose a donor');
      if (donor.isIndianCitizen == null) throw new BadRequestException("Record the donor's citizenship first");
      const fund = await this.fundFor(donor.isIndianCitizen);
      const d = await tx.donation.create({ data: { tenantId, donorId: donor.id, campaignId: b.campaignId, amountMinor: b.amountMinor, fund, method: b.method, status: 'CREATED', wants80G: b.wants80G ?? false, isAnonymous: b.isAnonymous ?? false, reference: b.reference, publicToken: randomToken(32), recordedById: requireUser().id } });
      await tx.payment.create({ data: { tenantId, donationId: d.id, provider: 'OFFLINE', amountMinor: b.amountMinor, status: 'CAPTURED', settledAt: b.receivedAt } });
      await this.complete(tx, d, b.receivedAt);
      return d.id;
    });
    await this.audit.log('CREATE', 'donation', id, undefined, { ...b, donor: undefined });
    return { id };
  }
  private async newDonor(d: DonorInput): Promise<Prisma.DonorUncheckedCreateInput> {
    const tenantId = requireTenant().id;
    if (d.pan && !PAN_REGEX.test(d.pan)) throw new BadRequestException({ code: 'BAD_PAN', message: 'PAN is not valid' });
    return { tenantId, fullName: d.fullName, email: d.email?.toLowerCase(), phone: d.phone, address: d.address, isIndianCitizen: d.isIndianCitizen, marketingConsent: d.marketingConsent ?? false, ...(d.pan ? { panEnc: this.receipts.cipher.encrypt(d.pan, `pan:${tenantId}`), panLast4: d.pan.slice(-4) } : {}) };
  }

  // ---------- refunds ----------

  async requestRefund(donationId: string, amountMinor: number, reason: string) {
    const tenantId = requireTenant().id;
    const refund = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, donationId);
      const d = await tx.donation.findFirst({ where: { id: donationId }, include: { payments: true, refunds: { where: { status: 'PENDING' } } } });
      if (!d || !['COMPLETED', 'PARTIALLY_REFUNDED'].includes(d.status)) throw new BadRequestException('This donation cannot be refunded');
      const payment = d.payments.find((p) => p.status === 'CAPTURED' || p.status === 'PARTIALLY_REFUNDED');
      if (!payment || d.method === 'IN_KIND') throw new BadRequestException('There is no payment to refund');
      const reserved = d.refunds.reduce((a, r) => a + r.amountMinor, 0n);
      if (BigInt(amountMinor) > d.amountMinor - d.refundedMinor - reserved) throw new BadRequestException('That is more than the remaining amount');
      const r = await tx.refund.create({ data: { tenantId, donationId, paymentId: payment.id, amountMinor, reason, requestedById: requireUser().id } });
      await this.jobs.enqueue('refund.run', { refundId: r.id }, { tx: tx as never, tenantId, dedupeKey: `refund:${r.id}` });
      return r;
    });
    await this.audit.log('REFUND', 'donation', donationId, undefined, { amountMinor, reason });
    return { id: refund.id, status: refund.status };
  }
  private async runRefund(refundId: string) {
    const r = await this.prisma.refund.findFirst({ where: { id: refundId, status: 'PENDING' }, include: { payment: true, donation: true } });
    if (!r || r.providerRefundId) return;
    if (r.payment.provider === 'OFFLINE') return this.finishRefund(r.id, null);
    const gateway = await this.gateways.byProvider(r.payment.provider, r.donation.fund);
    try {
      const g = await gateway.refund(r.payment.providerPaymentId!, Number(r.amountMinor), r.id);
      if (g.status === 'failed') { await this.prisma.refund.update({ where: { id: r.id }, data: { status: 'FAILED', providerRefundId: g.id } }); return; }
      await this.prisma.refund.update({ where: { id: r.id }, data: { providerRefundId: g.id } });
      if (g.status === 'processed') await this.finishRefund(r.id, g.id);
    } catch (e) {
      // A clear refusal is final. Timeouts and 5xx are retried with the same idempotency key.
      const code = (e as { getResponse?: () => { code?: string } }).getResponse?.().code;
      if (code === 'GATEWAY_REJECTED') { await this.prisma.refund.update({ where: { id: r.id }, data: { status: 'FAILED', error: (e as Error).message } }); return; }
      throw e;
    }
  }
  async finishRefund(refundId: string, providerRefundId: string | null) {
    const ref = await this.prisma.refund.findFirstOrThrow({ where: { id: refundId } });
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, ref.donationId);
      const r = await tx.refund.findFirstOrThrow({ where: { id: refundId }, include: { donation: { include: { donor: true } }, payment: true } });
      if (r.status !== 'PENDING') return;
      const d = r.donation;
      const total = d.refundedMinor + r.amountMinor;
      const full = total === d.amountMinor;
      await tx.refund.update({ where: { id: r.id }, data: { status: 'PROCESSED', processedAt: new Date(), providerRefundId: providerRefundId ?? undefined } });
      await tx.donation.update({ where: { id: d.id }, data: { refundedMinor: total, status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      await tx.payment.update({ where: { id: r.paymentId }, data: { status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
      const credit = r.payment.provider !== 'OFFLINE' ? 'GATEWAY_CLEARING' : d.method === 'CASH' ? 'CASH' : 'BANK';
      await this.journal(tx, d, [['REFUNDS', r.amountMinor, 0n], [credit, 0n, r.amountMinor]], 'Donation refunded');
      await this.receipts.void(tx, d.id, full ? 'Fully refunded' : 'Partly refunded');
      if (!full) await this.receipts.issue(tx, d.id);
      if (d.donor.email) await this.notify.send({ template: 'donation.refunded', to: d.donor.email, userId: d.donor.userId, vars: { name: d.donor.fullName, amount: formatMinor(r.amountMinor, d.currency) }, tx: tx as never });
      await this.hooks.emit('DONATION_REFUNDED', { id: d.id, refundedMinor: Number(total) }, tx as never);
    });
  }

  // ---------- gateway webhooks ----------

  async receive(provider: PaymentProviderCode, raw: Buffer, signature: string, eventId: string) {
    const found = await this.gateways.forWebhook(provider, raw, signature);
    if (!found) throw new ForbiddenException('Bad signature');
    const payload = JSON.parse(raw.toString()) as { event: string };
    const tenantId = requireTenant().id;
    const { count } = await this.prisma.providerEvent.createMany({ data: [{ tenantId, provider, eventId, type: payload.event, payload: { ...payload, _fund: found.fund } as Prisma.InputJsonValue }], skipDuplicates: true });
    if (count) {
      const row = await this.prisma.providerEvent.findFirstOrThrow({ where: { provider, eventId } });
      await this.jobs.enqueue('payment.event', { eventId: row.id }, { tenantId, dedupeKey: `pe:${row.id}` });
    }
    return { ok: true };
  }

  private async processEvent(id: string) {
    const ev = await this.prisma.providerEvent.findFirst({ where: { id, processedAt: null } });
    if (!ev) return;
    type Ent = { entity: Record<string, any> };
    const body = ev.payload as unknown as { event: string; _fund: Fund; payload: { payment?: Ent; refund?: Ent; subscription?: Ent } };
    const pay = body.payload.payment?.entity;
    const sub = body.payload.subscription?.entity;
    try {
      switch (body.event) {
        case 'payment.captured':
          if (pay?.order_id && !pay.invoice_id && (await this.prisma.payment.findFirst({ where: { provider: ev.provider, providerOrderId: pay.order_id } }))) {
            await this.capture(ev.provider, { id: pay.id, orderId: pay.order_id, amountMinor: pay.amount, currency: pay.currency, status: 'captured', feeMinor: pay.fee ?? 0 });
          }
          break;
        case 'payment.failed':
          if (pay?.order_id) await this.fail(ev.provider, pay.order_id, pay.error_description ?? 'Payment failed');
          break;
        case 'subscription.charged':
          if (sub && pay) await this.charge(ev.provider, body._fund, sub.id, { id: pay.id, orderId: null, amountMinor: pay.amount, currency: pay.currency, status: 'captured', feeMinor: pay.fee ?? 0 }, sub.charge_at);
          break;
        case 'subscription.activated':
          await this.prisma.subscription.updateMany({ where: { provider: ev.provider, providerSubscriptionId: sub?.id, status: { in: ['CREATED', 'PAUSED'] } }, data: { status: 'ACTIVE' } });
          break;
        case 'subscription.cancelled':
        case 'subscription.completed':
        case 'subscription.halted':
          await this.prisma.subscription.updateMany({ where: { provider: ev.provider, providerSubscriptionId: sub?.id }, data: body.event.endsWith('cancelled') ? { status: 'CANCELLED', cancelledAt: new Date() } : { status: body.event.endsWith('completed') ? 'COMPLETED' : 'FAILED' } });
          break;
        case 'refund.processed': {
          const r = body.payload.refund?.entity;
          const row = r && (await this.prisma.refund.findFirst({ where: { OR: [{ providerRefundId: r.id }, { id: r.notes?.key ?? '-' }] } }));
          if (row) await this.finishRefund(row.id, r.id);
          break;
        }
        case 'refund.failed': {
          const r = body.payload.refund?.entity;
          if (r) await this.prisma.refund.updateMany({ where: { providerRefundId: r.id, status: 'PENDING' }, data: { status: 'FAILED', error: 'Gateway reported failure' } });
          break;
        }
      }
      await this.prisma.providerEvent.update({ where: { id }, data: { processedAt: new Date(), error: null } });
    } catch (e) {
      await this.prisma.providerEvent.update({ where: { id }, data: { error: String((e as Error).message).slice(0, 500) } });
      throw e;
    }
  }
  private async fail(provider: PaymentProviderCode, orderId: string, error: string) {
    // The donor may retry the same order, so a later capture still wins.
    const p = await this.prisma.payment.findFirst({ where: { provider, providerOrderId: orderId } });
    if (!p) return;
    const { count } = await this.prisma.payment.updateMany({ where: { id: p.id, status: 'CREATED' }, data: { status: 'FAILED', error: error.slice(0, 300) } });
    if (count) {
      await this.prisma.donation.updateMany({ where: { id: p.donationId, status: 'PENDING' }, data: { status: 'FAILED' } });
      await this.hooks.emit('DONATION_FAILED', { id: p.donationId });
    }
  }
  private async charge(provider: PaymentProviderCode, fund: Fund, providerSubscriptionId: string, gp: GatewayPayment, chargeAt?: number) {
    const s = await this.prisma.subscription.findFirst({ where: { provider, providerSubscriptionId } });
    if (!s) return;
    if (Number(s.amountMinor) !== gp.amountMinor || s.currency !== gp.currency) throw new ConflictException('Charged amount does not match the subscription');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM subscriptions WHERE id = ${s.id} AND "tenantId" = ${s.tenantId} FOR UPDATE`;
      if (await tx.payment.findFirst({ where: { provider, providerPaymentId: gp.id } })) return;
      const d = await tx.donation.create({ data: { tenantId: s.tenantId, donorId: s.donorId, campaignId: s.campaignId, subscriptionId: s.id, amountMinor: s.amountMinor, currency: s.currency, fund, status: 'PENDING', wants80G: s.wants80G, publicToken: randomToken(32) } });
      await tx.payment.create({ data: { tenantId: s.tenantId, donationId: d.id, provider, providerPaymentId: gp.id, amountMinor: s.amountMinor, feeMinor: gp.feeMinor, status: 'CAPTURED' } });
      await this.complete(tx, d);
      await tx.subscription.updateMany({ where: { id: s.id, status: { not: 'CANCELLED' } }, data: { status: 'ACTIVE', nextChargeAt: chargeAt ? new Date(chargeAt * 1000) : undefined } });
    });
  }
  async cancelSubscription(id: string, mine?: { userId: string }) {
    const s = await this.prisma.subscription.findFirst({ where: { id, ...(mine ? { donor: { userId: mine.userId } } : {}) }, include: { donor: true } });
    if (!s) throw new NotFoundException('Recurring donation not found');
    if (['CANCELLED', 'COMPLETED'].includes(s.status)) return { status: s.status };
    const gateway: Gateway = await this.gateways.byProvider(s.provider, s.donor.isIndianCitizen === false ? 'FCRA' : 'DOMESTIC');
    if (s.providerSubscriptionId) await gateway.cancelSubscription(s.providerSubscriptionId);
    await this.prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await this.audit.log('UPDATE', 'subscription', id, { status: s.status }, { status: 'CANCELLED' });
    if (s.donor.email) await this.notify.send({ template: 'subscription.cancelled', to: s.donor.email, userId: s.donor.userId, vars: { name: s.donor.fullName, amount: formatMinor(s.amountMinor, s.currency) } });
    await this.hooks.emit('SUBSCRIPTION_CANCELLED', { id });
    return { status: 'CANCELLED' };
  }

  /** Books money reaching the bank: bank + fee against clearing. */
  async settle(rows: { paymentId: string; feeMinor: number; settlementRef: string; settledAt: Date }[]) {
    const result = { settled: 0, already: 0, unknown: [] as string[], errors: [] as string[] };
    for (const row of rows) {
      const p = await this.prisma.payment.findFirst({ where: { providerPaymentId: row.paymentId, provider: { not: 'OFFLINE' } }, include: { donation: true } });
      if (!p) { result.unknown.push(row.paymentId); continue; }
      if (BigInt(row.feeMinor) >= p.amountMinor || row.feeMinor < 0) { result.errors.push(`${row.paymentId}: fee is not valid`); continue; }
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.payment.updateMany({ where: { id: p.id, settledAt: null, status: { in: ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } }, data: { settledAt: row.settledAt, settlementRef: row.settlementRef, feeMinor: row.feeMinor } });
        if (!count) { result.already++; return; }
        const fee = BigInt(row.feeMinor);
        await this.journal(tx, p.donation, [['BANK', p.amountMinor - fee, 0n], ['GATEWAY_FEES', fee, 0n], ['GATEWAY_CLEARING', 0n, p.amountMinor]], `Settlement ${row.settlementRef}`, row.settledAt);
        result.settled++;
      });
    }
    await this.audit.log('IMPORT', 'settlement', null, undefined, result);
    return result;
  }
}
