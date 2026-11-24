import { BadRequestException, Controller, Get, HttpCode, Module, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocaleCode, PageStatus } from '@prisma/client';
import { hmacSha256, randomToken, safeEqual } from '@vashundhara-foundation/auth';
import { hasPermission } from '@vashundhara-foundation/shared';
import { z } from 'zod';
import { getCtx, requireTenant } from '../../common/context/context';
import { crudController } from '../../common/crud/crud';
import { TenantResolver } from '../../common/http/context.middleware';
import { Can, PageQuery, Paging, Public, RateLimit, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { Email } from '../auth/auth.module';
import { NotificationsService } from '../notifications/notifications.module';

const text = (n: number) => z.string().trim().min(1).max(n);
const path = z.string().regex(/^\/[A-Za-z0-9/_%.-]{0,300}$/, 'Use a path on this site, starting with /').refine((p) => !p.startsWith('//'), 'Use a path on this site');

const Pages = crudController({
  path: 'pages', resource: 'content', model: 'page', search: ['title', 'slug'], filters: ['kind', 'status', 'locale'], sort: ['title', 'publishedAt'],
  schema: z.object({ slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/), locale: z.enum(LocaleCode).optional(), kind: z.enum(['page', 'post']).optional(), title: text(200), excerpt: z.string().max(500).nullish(), body: text(200_000), status: z.enum(PageStatus).optional() }),
  prepare: (d, { existing }) => (d.status === 'PUBLISHED' && !existing?.publishedAt ? { ...d, publishedAt: new Date() } : d)
});
const Redirects = crudController({ path: 'redirects', resource: 'content', model: 'redirect', search: ['fromPath'], schema: z.object({ fromPath: path, toPath: path }) });

const Contact = z.object({ name: text(100), email: Email, phone: z.string().max(20).optional(), message: text(5000), website: z.string().max(0).optional() });
@ApiTags('public')
@Controller('public')
export class PublicContentController {
  constructor(private readonly prisma: PrismaService, private readonly notify: NotificationsService, private readonly tenants: TenantResolver) {}
  @Get('pages') @Public()
  async pages(@ZQuery(PageQuery.extend({ kind: z.enum(['page', 'post']).optional() })) p: Paging & { kind?: string }) {
    const where = { status: 'PUBLISHED' as const, deletedAt: null, ...(p.kind ? { kind: p.kind } : {}) };
    const [items, total] = await Promise.all([this.prisma.page.findMany({ where, orderBy: { publishedAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { body: true } }), this.prisma.page.count({ where })]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get('pages/:slug') @Public()
  async page(@Param('slug') slug: string, @Query('locale') locale = 'en') {
    const rows = await this.prisma.page.findMany({ where: { slug, status: 'PUBLISHED', deletedAt: null } });
    const t = requireTenant();
    const row = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === t.defaultLocale) ?? rows[0];
    if (!row) throw new NotFoundException('Page not found');
    return row;
  }
  @Get('redirect') @Public()
  async redirect(@Query('path') from: string) {
    const r = await this.prisma.redirect.findFirst({ where: { fromPath: String(from).replace(/\/$/, '') || '/' } });
    return { to: r?.toPath ?? null };
  }
  @Post('contact') @Public() @HttpCode(200) @RateLimit(5, 3600)
  async contact(@ZBody(Contact) b: z.infer<typeof Contact>) {
    const { website: _trap, ...data } = b;
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: requireTenant().id } });
    await this.prisma.contactMessage.create({ data: { ...data, tenantId: t.id } });
    const to = (t.settings as { contactEmail?: string }).contactEmail;
    if (to) await this.notify.send({ template: 'contact.received', to, vars: data });
    return { ok: true };
  }
  @Post('newsletter') @Public() @HttpCode(200) @RateLimit(5, 3600, 'email')
  async subscribe(@ZBody(z.object({ email: Email })) b: { email: string }) {
    const t = requireTenant();
    let s = await this.prisma.newsletterSubscriber.findFirst({ where: { email: b.email } });
    if (s?.confirmedAt && !s.unsubscribedAt) return { ok: true };
    s ??= await this.prisma.newsletterSubscriber.create({ data: { tenantId: t.id, email: b.email, unsubscribeToken: randomToken(24) } });
    const sig = hmacSha256(`confirm:${s.id}`, s.unsubscribeToken);
    await this.notify.send({ template: 'newsletter.confirm', to: b.email, vars: { link: `${this.tenants.url(t)}/${t.defaultLocale}/newsletter#id=${s.id}&sig=${sig}` } });
    return { ok: true };
  }
  @Post('newsletter/confirm') @Public() @HttpCode(200) @RateLimit(20, 3600)
  async confirm(@ZBody(z.object({ id: z.string().max(60), sig: z.string().max(100) })) b: { id: string; sig: string }) {
    const s = await this.prisma.newsletterSubscriber.findFirst({ where: { id: b.id } });
    if (!s || !safeEqual(hmacSha256(`confirm:${s.id}`, s.unsubscribeToken), b.sig)) throw new BadRequestException('This link is not valid');
    await this.prisma.newsletterSubscriber.update({ where: { id: s.id }, data: { confirmedAt: new Date(), unsubscribedAt: null } });
    await this.prisma.consentRecord.create({ data: { tenantId: s.tenantId, email: s.email, purpose: 'newsletter', version: '1', granted: true, ipAddress: getCtx()?.ip } });
    return { ok: true };
  }
  @Post('newsletter/unsubscribe') @Public() @HttpCode(200) @RateLimit(20, 3600)
  async unsubscribe(@ZBody(z.object({ token: z.string().max(100) })) b: { token: string }) {
    await this.prisma.newsletterSubscriber.updateMany({ where: { unsubscribeToken: b.token }, data: { unsubscribedAt: new Date() } });
    return { ok: true };
  }
}
@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @Can('messages:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const [items, total] = await Promise.all([this.prisma.contactMessage.findMany({ orderBy: [{ handledAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }], skip: (p.page - 1) * p.limit, take: p.limit }), this.prisma.contactMessage.count()]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Put(':id/handled') @Can('messages:update')
  handled(@Param('id') id: string) { return this.prisma.contactMessage.update({ where: { id }, data: { handledAt: new Date() } }); }
}

/** Searches only what the signed-in person may read. */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @SelfService()
  async search(@Query('q') q = '') {
    const term = String(q).trim().slice(0, 80);
    if (term.length < 2) return { items: [] };
    const can = (p: string) => hasPermission(getCtx()!.permissions, p);
    const has = { contains: term, mode: 'insensitive' as const };
    const live = { deletedAt: null };
    const out: Promise<{ type: string; id: string; title: string }[]>[] = [];
    if (can('campaigns:read')) out.push(this.prisma.campaign.findMany({ where: { ...live, title: has }, take: 5 }).then((r) => r.map((x) => ({ type: 'campaigns', id: x.id, title: x.title }))));
    if (can('donors:read')) out.push(this.prisma.donor.findMany({ where: { ...live, OR: [{ fullName: has }, { email: has }] }, take: 5 }).then((r) => r.map((x) => ({ type: 'donors', id: x.id, title: x.fullName }))));
    if (can('crm:read')) out.push(this.prisma.contact.findMany({ where: { ...live, OR: [{ firstName: has }, { lastName: has }, { email: has }] }, take: 5 }).then((r) => r.map((x) => ({ type: 'crm/contacts', id: x.id, title: `${x.firstName} ${x.lastName}` }))));
    if (can('volunteers:read')) out.push(this.prisma.volunteer.findMany({ where: { ...live, OR: [{ firstName: has }, { lastName: has }] }, take: 5 }).then((r) => r.map((x) => ({ type: 'volunteers', id: x.id, title: `${x.firstName} ${x.lastName}` }))));
    if (can('beneficiaries:read')) out.push(this.prisma.beneficiary.findMany({ where: { ...live, fullName: has }, take: 5 }).then((r) => r.map((x) => ({ type: 'beneficiaries', id: x.id, title: x.fullName }))));
    if (can('students:read')) out.push(this.prisma.student.findMany({ where: { ...live, fullName: has }, take: 5 }).then((r) => r.map((x) => ({ type: 'students', id: x.id, title: x.fullName }))));
    if (can('events:read')) out.push(this.prisma.event.findMany({ where: { ...live, title: has }, take: 5 }).then((r) => r.map((x) => ({ type: 'events', id: x.id, title: x.title }))));
    return { items: (await Promise.all(out)).flat() };
  }
}
@Module({ controllers: [Pages, Redirects, PublicContentController, MessagesController, SearchController] })
export class ContentModule {}
