import { BadRequestException, Controller, Get, Inject, Module, OnModuleInit, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrencyCode, LocaleCode } from '@prisma/client';
import { FieldCipher } from '@vashundhara-foundation/auth';
import { evaluate, Flag } from '@vashundhara-foundation/feature-flags';
import { toMinor } from '@vashundhara-foundation/shared';
import { z } from 'zod';
import { ENV, Env } from '../../env';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant } from '../../common/context/context';
import { TenantResolver } from '../../common/http/context.middleware';
import { Can, PageQuery, Paging, Public, ZBody, ZQuery } from '../../common/http/decorators';
import { JobsService } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';
import { RedisService } from '../../common/redis/redis.module';
import { toCsv } from '../../common/crud/csv';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const TenantSettings = z.object({
  primaryColor: color.optional(), tagline: z.string().max(200).optional(), about: z.string().max(5000).optional(),
  contactEmail: z.email().optional(), contactPhone: z.string().max(30).optional(), contactAddress: z.string().max(500).optional(),
  facebook: z.url({ protocol: /^https$/ }).optional(), instagram: z.url({ protocol: /^https$/ }).optional(), youtube: z.url({ protocol: /^https$/ }).optional(), linkedin: z.url({ protocol: /^https$/ }).optional(),
  /** Impact figures are typed by the NGO and must carry their source. */
  impact: z.array(z.object({ value: z.string().max(20), label: z.string().max(60), source: z.string().min(3).max(200) })).max(6).optional(),
  minDonationMinor: z.number().int().min(100).max(10_000_000).optional()
}).strict();
const Update = z.object({ displayName: z.string().min(2).max(150), description: z.string().max(1000), logoUrl: z.string().max(300), defaultLocale: z.enum(LocaleCode), supportedLocales: z.array(z.enum(LocaleCode)).min(1), timezone: z.string().max(60), settings: TenantSettings }).partial().strict();

@ApiTags('tenant')
@Controller('tenant')
export class TenantController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly tenants: TenantResolver) {}
  /** What the public website needs to draw itself. */
  @Get('public') @Public()
  async publicInfo() {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: requireTenant().id } });
    const c = await this.prisma.complianceProfile.findFirst();
    const now = new Date();
    return {
      slug: t.slug, name: t.displayName ?? t.name, description: t.description, logoUrl: t.logoUrl, status: t.status, url: this.tenants.url(t),
      defaultLocale: t.defaultLocale, supportedLocales: t.supportedLocales, currency: t.defaultCurrency, settings: t.settings,
      legalName: c?.legalName ?? null, registrationNo: c?.registrationNo ?? null,
      has80G: Boolean(c?.reg80G && c.pan && (!c.reg80GValidUntil || c.reg80GValidUntil > now)),
      acceptsForeign: Boolean(c?.fcraVerifiedAt && c.fcraValidUntil && c.fcraValidUntil > now)
    };
  }
  @Get('settings') @Can('settings:read')
  settings() { return this.prisma.tenant.findUnique({ where: { id: requireTenant().id } }); }
  @Put('settings') @Can('settings:update')
  async update(@ZBody(Update) b: z.infer<typeof Update>) {
    const { id } = requireTenant();
    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const settings = b.settings ? { ...(before.settings as object), ...b.settings } : undefined;
    const t = await this.prisma.tenant.update({ where: { id }, data: { ...b, settings } });
    await this.tenants.invalidate(t);
    await this.audit.log('CONFIG_CHANGE', 'tenant', id, before, t);
    return t;
  }
}

const Compliance = z.object({
  legalName: z.string().min(2).max(200), registrationNo: z.string().max(60).nullish(), pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).nullish(), address: z.record(z.string(), z.string().max(200)).nullish(),
  reg80G: z.string().max(60).nullish(), reg80GValidFrom: z.coerce.date().nullish(), reg80GValidUntil: z.coerce.date().nullish(), reg12A: z.string().max(60).nullish(), csr1No: z.string().max(60).nullish(),
  fcraNo: z.string().max(60).nullish(), fcraValidUntil: z.coerce.date().nullish(), signatoryName: z.string().max(100).nullish(), signatoryTitle: z.string().max(100).nullish()
}).strict();
const Account = z.object({ provider: z.enum(['RAZORPAY', 'MOCK']), fund: z.enum(['DOMESTIC', 'FCRA']), keyId: z.string().min(4).max(100), keySecret: z.string().min(8).max(200), webhookSecret: z.string().min(8).max(200), isActive: z.boolean() }).strict();

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  private readonly cipher: FieldCipher;
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, @Inject(ENV) private readonly env: Env) { this.cipher = new FieldCipher(env.ENCRYPTION_KEY); }
  @Get() @Can('compliance:read')
  async get() { return (await this.prisma.complianceProfile.findFirst()) ?? {}; }
  @Put() @Can('compliance:update')
  async put(@ZBody(Compliance) b: z.infer<typeof Compliance>) {
    const tenantId = requireTenant().id;
    const before = await this.prisma.complianceProfile.findFirst();
    const fcraChanged = before && (before.fcraNo !== (b.fcraNo ?? null) || before.fcraValidUntil?.getTime() !== b.fcraValidUntil?.getTime());
    const data = { ...b, address: b.address ?? undefined, ...(fcraChanged ? { fcraVerifiedAt: null, fcraVerifiedById: null } : {}) };
    const row = before ? await this.prisma.complianceProfile.update({ where: { id: before.id }, data }) : await this.prisma.complianceProfile.create({ data: { ...data, tenantId } });
    await this.audit.log('CONFIG_CHANGE', 'compliance', row.id, before, row);
    return row;
  }
  @Get('payment-accounts') @Can('payment_accounts:read')
  async accounts() { return { items: await this.prisma.paymentAccount.findMany({ omit: { keySecretEnc: true, webhookSecretEnc: true } }), webhookPath: `/api/v1/payments/razorpay/webhook/${requireTenant().slug}` }; }
  @Put('payment-accounts') @Can('payment_accounts:update')
  async account(@ZBody(Account) b: z.infer<typeof Account>) {
    if (b.provider === 'MOCK' && this.env.NODE_ENV === 'production') throw new BadRequestException('The test gateway is not available in production');
    if (b.provider === 'RAZORPAY' && !/^rzp_(test|live)_/.test(b.keyId)) throw new BadRequestException('That does not look like a Razorpay key id');
    const tenantId = requireTenant().id;
    const aad = `pay:${tenantId}:${b.provider}:${b.fund}`;
    const data = { keyId: b.keyId, keySecretEnc: this.cipher.encrypt(b.keySecret, aad), webhookSecretEnc: this.cipher.encrypt(b.webhookSecret, aad), isActive: b.isActive };
    const existing = await this.prisma.paymentAccount.findFirst({ where: { provider: b.provider, fund: b.fund } });
    const row = existing ? await this.prisma.paymentAccount.update({ where: { id: existing.id }, data }) : await this.prisma.paymentAccount.create({ data: { ...data, tenantId, provider: b.provider, fund: b.fund } });
    await this.audit.log('CONFIG_CHANGE', 'paymentAccount', row.id, existing, row);
    return { ok: true };
  }
}

const FlagSet = z.object({ key: z.string().max(80), isEnabled: z.boolean(), rolloutPercentage: z.number().int().min(0).max(100) });
@ApiTags('flags')
@Controller('feature-flags')
export class FlagsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  private async effective() {
    const rows = await this.prisma.featureFlag.findMany({ where: { deletedAt: null }, orderBy: { tenantId: { sort: 'desc', nulls: 'first' } } });
    return [...new Map(rows.map((r) => [r.key, r])).values()];
  }
  @Get('evaluate') @Public()
  async evaluate() {
    const c = getCtx()!;
    const subject = c.user?.id ?? c.tenant?.id ?? 'anon';
    return Object.fromEntries((await this.effective()).map((f) => [f.key, evaluate(f as Flag, subject).value]));
  }
  @Get() @Can('feature_flags:read')
  async list() { return { items: await this.effective() }; }
  @Put() @Can('feature_flags:update')
  async set(@ZBody(FlagSet) b: z.infer<typeof FlagSet>) {
    const tenantId = requireTenant().id;
    const base = await this.prisma.featureFlag.findFirst({ where: { key: b.key, tenantId: null } });
    if (!base) throw new BadRequestException('Unknown flag');
    const own = await this.prisma.featureFlag.findFirst({ where: { key: b.key, tenantId } });
    const data = { isEnabled: b.isEnabled, rolloutPercentage: b.rolloutPercentage };
    if (own) await this.prisma.featureFlag.update({ where: { id: own.id }, data });
    else await this.prisma.featureFlag.create({ data: { tenantId, key: base.key, name: base.name, description: base.description, type: base.type, defaultValue: base.defaultValue ?? true, ...data } });
    await this.audit.log('CONFIG_CHANGE', 'featureFlag', b.key, own, b);
    return { ok: true };
  }
}

const Tr = z.object({ locale: z.enum(LocaleCode), key: z.string().regex(/^[\w.]{1,150}$/), value: z.string().min(1).max(5000), isReviewed: z.boolean().optional() });
@ApiTags('i18n')
@Controller('translations')
export class TranslationsController {
  constructor(private readonly prisma: PrismaService) {}
  /** An NGO's own wording, applied on top of the built-in translations. */
  @Get('public') @Public()
  async publicList(@Query('locale') locale: string) {
    if (!Object.values(LocaleCode).includes(locale as LocaleCode)) return {};
    const rows = await this.prisma.translation.findMany({ where: { locale: { code: locale as LocaleCode } }, orderBy: { tenantId: { sort: 'asc', nulls: 'first' } } });
    return Object.fromEntries(rows.map((r) => [`${r.namespace}.${r.key}`, r.value]));
  }
  @Get() @Can('translations:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const where = p.q ? { OR: [{ key: { contains: p.q } }, { value: { contains: p.q, mode: 'insensitive' as const } }] } : {};
    const [items, total] = await Promise.all([this.prisma.translation.findMany({ where, include: { locale: { select: { code: true } } }, skip: (p.page - 1) * p.limit, take: p.limit }), this.prisma.translation.count({ where })]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Put() @Can('translations:update')
  async put(@ZBody(Tr) b: z.infer<typeof Tr>) {
    const l = await this.prisma.locale.findUniqueOrThrow({ where: { code: b.locale } });
    const [namespace, ...rest] = b.key.split('.');
    const key = rest.join('.');
    const tenantId = requireTenant().id;
    const own = await this.prisma.translation.findFirst({ where: { namespace, key, localeId: l.id, tenantId } });
    return own ? this.prisma.translation.update({ where: { id: own.id }, data: { value: b.value, isReviewed: b.isReviewed } })
      : this.prisma.translation.create({ data: { namespace, key, value: b.value, isReviewed: b.isReviewed, localeId: l.id, tenantId } });
  }
}

@ApiTags('currency')
@Controller('currencies')
export class CurrencyController implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly jobs: JobsService, @Inject(ENV) private readonly env: Env) {}
  onModuleInit() {
    this.jobs.every(86_400, 'currency.sync', () => this.sync());
  }
  @Get() @Public()
  async list() { return { items: await this.prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }) }; }
  private async rate(code: CurrencyCode): Promise<number> {
    if (code === 'USD') return 1;
    return this.redis.cached(`fx:${code}`, 3600, async () => {
      const r = await this.prisma.exchangeRate.findFirst({ where: { targetCurrency: { code }, baseCurrency: { code: 'USD' }, validFrom: { lte: new Date() } }, orderBy: { validFrom: 'desc' } });
      if (!r) throw new BadRequestException(`No rate for ${code}`);
      return Number(r.rate);
    });
  }
  /** For display only. Donations are always charged in the NGO's own currency. */
  @Get('convert') @Public()
  async convert(@Query('from') from: string, @Query('to') to: string, @Query('amount') amount: string) {
    const codes = Object.values(CurrencyCode);
    if (!codes.includes(from as CurrencyCode) || !codes.includes(to as CurrencyCode)) throw new BadRequestException('Unknown currency');
    if (toMinor(String(amount), from as CurrencyCode) === null) throw new BadRequestException('Invalid amount');
    const rate = (await this.rate(to as CurrencyCode)) / (await this.rate(from as CurrencyCode));
    return { rate, amount: Math.round(Number(amount) * rate * 100) / 100, indicative: true };
  }
  @Post('sync') @Can('currencies:update')
  async syncNow() { await this.jobs.enqueue('currency.sync', {}, { dedupeKey: `fx-manual:${Math.floor(Date.now() / 600_000)}` }); return { queued: true }; }
  private async sync() {
    if (!this.env.EXCHANGE_RATE_API_KEY) return;
    const r = await fetch(`https://v6.exchangerate-api.com/v6/${this.env.EXCHANGE_RATE_API_KEY}/latest/USD`, { signal: AbortSignal.timeout(15_000) });
    const body = (await r.json()) as { result: string; conversion_rates: Record<string, number> };
    if (!r.ok || body.result !== 'success') throw new Error('Exchange rate provider failed');
    const all = await this.prisma.currency.findMany();
    const usd = all.find((c) => c.code === 'USD')!;
    const validFrom = new Date();
    for (const c of all) {
      const rate = body.conversion_rates[c.code];
      if (rate > 0) await this.prisma.exchangeRate.create({ data: { baseCurrencyId: usd.id, targetCurrencyId: c.id, rate, validFrom, fetchedAt: validFrom } });
      await this.redis.del(`fx:${c.code}`);
    }
  }
}

const AuditQuery = PageQuery.extend({ action: z.string().max(30).optional(), resource: z.string().max(60).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() });
@ApiTags('audit')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  private where(p: z.infer<typeof AuditQuery>) {
    return { ...(p.action ? { action: p.action as never } : {}), ...(p.resource ? { resource: p.resource } : {}), ...(p.from || p.to ? { createdAt: { gte: p.from, lte: p.to } } : {}) };
  }
  @Get() @Can('audit_logs:read')
  async list(@ZQuery(AuditQuery) p: z.infer<typeof AuditQuery>) {
    const where = this.where(p);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, include: { user: { select: { email: true } } } }),
      this.prisma.auditLog.count({ where })
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get('export') @Can('audit_logs:export')
  async export(@ZQuery(AuditQuery) p: z.infer<typeof AuditQuery>) {
    const rows = await this.prisma.auditLog.findMany({ where: this.where(p), orderBy: { createdAt: 'desc' }, take: 20_000, include: { user: { select: { email: true } } } });
    await this.audit.log('EXPORT', 'auditLog', null, undefined, { rows: rows.length });
    return { filename: 'audit.csv', csv: toCsv(['createdAt', 'user', 'action', 'resource', 'resourceId', 'ipAddress'], rows.map((r) => ({ ...r, user: r.user?.email }))) };
  }
}

@Module({ controllers: [TenantController, ComplianceController, FlagsController, TranslationsController, CurrencyController, AuditController] })
export class SettingsModule {}
