import { BadRequestException, Controller, Get, HttpCode, Module, NotFoundException, OnModuleInit, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventStatus, FeedbackStatus, Prisma } from '@prisma/client';
import { randomToken } from '@vashundhara-foundation/auth';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { crudController } from '../../common/crud/crud';
import { Can, PageQuery, Paging, Public, RateLimit, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { JobsService } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';
import { Email, Slug } from '../auth/auth.module';
import { NotificationsService } from '../notifications/notifications.module';

const id = z.string().max(60);
const text = (n: number) => z.string().trim().min(1).max(n);
const opt = (n: number) => z.string().trim().max(n).nullish();
const https = z.url({ protocol: /^https$/ }).max(500);
const TAKEN = ['REGISTERED', 'ATTENDED'] as ('REGISTERED' | 'ATTENDED')[];

const Events = crudController({
  path: 'events', resource: 'events', model: 'event', search: ['title', 'venue'], filters: ['status', 'campaignId'], sort: ['startsAt'], defaultSort: { startsAt: 'desc' }, include: { _count: { select: { registrations: { where: { status: { in: TAKEN } } } } } },
  schema: z.object({ campaignId: id.nullish(), slug: Slug, title: text(150), summary: opt(300), description: opt(20_000), venue: opt(300), onlineUrl: https.nullish(), coverFileId: id.nullish(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), capacity: z.number().int().min(0).max(100_000).optional(), status: z.enum(EventStatus).optional() }),
  prepare: (d, { existing }) => { if (new Date(d.endsAt ?? existing?.endsAt) <= new Date(d.startsAt ?? existing?.startsAt)) throw new BadRequestException('The event must end after it starts'); return d; }
});
const Register = z.object({ name: text(120), email: Email, phone: opt(20) });
const CheckIn = z.object({ ticketCode: z.string().max(40) });

@ApiTags('events')
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly prisma: PrismaService, private readonly notify: NotificationsService) {}
  @Get() @Public()
  async list(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.EventWhereInput = { status: 'PUBLISHED', deletedAt: null, endsAt: { gt: new Date() } };
    const [items, total] = await Promise.all([this.prisma.event.findMany({ where, orderBy: { startsAt: 'asc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { onlineUrl: true, description: true } }), this.prisma.event.count({ where })]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get(':slug') @Public()
  async get(@Param('slug') slug: string) {
    const e = await this.prisma.event.findFirst({ where: { slug, status: { in: ['PUBLISHED', 'COMPLETED'] }, deletedAt: null }, omit: { onlineUrl: true }, include: { _count: { select: { registrations: { where: { status: { in: TAKEN } } } } } } });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }
  /** Answers the same way for a repeat email, so it cannot be used to see who is attending. */
  @Post(':slug/register') @Public() @HttpCode(200) @RateLimit(20, 3600)
  async register(@Param('slug') slug: string, @ZBody(Register) b: z.infer<typeof Register>) {
    const tenantId = requireTenant().id;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE slug = ${slug} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const e = await tx.event.findFirst({ where: { slug, status: 'PUBLISHED', deletedAt: null, endsAt: { gt: new Date() } } });
      if (!e) throw new NotFoundException('Registration is closed');
      let r = await tx.eventRegistration.findFirst({ where: { eventId: e.id, email: b.email } });
      if (!r || r.status === 'CANCELLED') {
        const taken = await tx.eventRegistration.count({ where: { eventId: e.id, status: { in: TAKEN } } });
        const status = e.capacity === 0 || taken < e.capacity ? ('REGISTERED' as const) : ('WAITLISTED' as const);
        r = r ? await tx.eventRegistration.update({ where: { id: r.id }, data: { status } }) : await tx.eventRegistration.create({ data: { ...b, tenantId, eventId: e.id, status, ticketCode: randomToken(12), userId: getCtx()?.user?.email === b.email ? getCtx()!.user!.id : null } });
      }
      await this.notify.send({ template: 'event.registered', to: b.email, tx: tx as never, vars: { name: r.name, title: e.title, when: e.startsAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }), status: r.status.toLowerCase(), code: r.status === 'REGISTERED' ? r.ticketCode : '-' } });
    });
    return { ok: true, message: 'Check your email for your ticket' };
  }
}
@ApiTags('events')
@Controller('event-desk')
export class EventDeskController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(':eventId/registrations') @Can('events:read')
  async list(@Param('eventId') eventId: string) { return { items: await this.prisma.eventRegistration.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' }, take: 5000 }) }; }
  @Post(':eventId/check-in') @Can('events:update') @HttpCode(200)
  async checkIn(@Param('eventId') eventId: string, @ZBody(CheckIn) b: { ticketCode: string }) {
    const r = await this.prisma.eventRegistration.findFirst({ where: { eventId, ticketCode: b.ticketCode } });
    if (!r) throw new NotFoundException('Ticket not found');
    const { count } = await this.prisma.eventRegistration.updateMany({ where: { id: r.id, status: 'REGISTERED' }, data: { status: 'ATTENDED', checkedInAt: new Date() } });
    if (!count) throw new BadRequestException(r.status === 'ATTENDED' ? 'This ticket was already used' : `Ticket is ${r.status.toLowerCase()}`);
    return { name: r.name };
  }
}

const SUBJECTS = ['campaign', 'event', 'course', 'libraryItem', 'ngo'] as const;
const FeedbackIn = z.object({ subjectType: z.enum(SUBJECTS), subjectId: id, rating: z.number().int().min(1).max(5), comment: opt(2000) });
const Moderate = z.object({ status: z.enum(FeedbackStatus), reply: opt(1000) });
@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  private async exists(type: (typeof SUBJECTS)[number], sid: string) {
    if (type === 'ngo') return sid === requireTenant().id;
    return Boolean(await (this.prisma[type] as unknown as { findFirst(a: unknown): Promise<unknown> }).findFirst({ where: { id: sid, deletedAt: null } }));
  }
  /** One review per person per thing; a second one replaces the first. Comments wait for approval. */
  @Post() @SelfService() @HttpCode(200) @RateLimit(30, 3600)
  async give(@ZBody(FeedbackIn) b: z.infer<typeof FeedbackIn>) {
    if (!(await this.exists(b.subjectType, b.subjectId))) throw new NotFoundException('Nothing to review');
    const u = requireUser();
    const data = { rating: b.rating, comment: b.comment, status: (b.comment ? 'PENDING' : 'APPROVED') as FeedbackStatus, authorName: u.firstName };
    const old = await this.prisma.feedback.findFirst({ where: { subjectType: b.subjectType, subjectId: b.subjectId, userId: u.id } });
    const row = old ? await this.prisma.feedback.update({ where: { id: old.id }, data: { ...data, reply: null } }) : await this.prisma.feedback.create({ data: { ...data, tenantId: requireTenant().id, subjectType: b.subjectType, subjectId: b.subjectId, userId: u.id } });
    return { id: row.id, status: row.status };
  }
  @Get('public/:type/:subjectId') @Public()
  async list(@Param('type') subjectType: string, @Param('subjectId') subjectId: string) {
    const where = { subjectType, subjectId, status: 'APPROVED' as const };
    const [items, agg] = await Promise.all([this.prisma.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50, select: { authorName: true, rating: true, comment: true, reply: true, createdAt: true } }), this.prisma.feedback.aggregate({ where, _avg: { rating: true }, _count: true })]);
    return { items, average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, count: agg._count };
  }
  @Get() @Can('feedback:read')
  async all(@ZQuery(PageQuery) p: Paging) {
    const [items, total] = await Promise.all([this.prisma.feedback.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], skip: (p.page - 1) * p.limit, take: p.limit }), this.prisma.feedback.count()]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Put(':id') @Can('feedback:update')
  async moderate(@Param('id') fid: string, @ZBody(Moderate) b: z.infer<typeof Moderate>) {
    const old = await this.prisma.feedback.findFirst({ where: { id: fid } });
    if (!old) throw new NotFoundException('Feedback not found');
    await this.prisma.feedback.update({ where: { id: fid }, data: { ...b, moderatedById: requireUser().id } });
    await this.audit.log('APPROVE', 'feedback', fid, { status: old.status }, b);
    return { ok: true };
  }
}

const CHANNELS = ['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'whatsapp'] as const;
const LIMITS: Partial<Record<(typeof CHANNELS)[number], number>> = { x: 280, instagram: 2200, linkedin: 3000 };
const Social = crudController({
  path: 'social-posts', resource: 'social', model: 'socialPost', search: ['title', 'body'], filters: ['status', 'campaignId'], sort: ['scheduledAt'], include: { campaign: { select: { title: true } } },
  schema: z.object({ title: text(150), body: text(5000), channels: z.array(z.enum(CHANNELS)).min(1), hashtags: z.array(z.string().regex(/^[\p{L}\p{M}\p{N}_]{1,50}$/u)).max(30).optional(), mediaFileIds: z.array(id).max(10).optional(), campaignId: id.nullish() }),
  prepare: async (d, { existing, user, prisma }) => {
    if (existing && !['DRAFT', 'IN_REVIEW', 'FAILED'].includes(existing.status)) throw new BadRequestException('An approved post cannot be edited. Return it to draft first.');
    const m = { ...existing, ...d };
    const length = m.body.length + (m.hashtags ?? []).reduce((a: number, h: string) => a + h.length + 2, 0);
    for (const c of m.channels as (typeof CHANNELS)[number][]) if (LIMITS[c] && length > LIMITS[c]!) throw new BadRequestException(`Too long for ${c}: ${length} of ${LIMITS[c]} characters`);
    if (d.mediaFileIds?.length && (await prisma.file.count({ where: { id: { in: d.mediaFileIds }, status: 'CLEAN', isPublic: true } })) !== new Set(d.mediaFileIds).size) throw new BadRequestException('Choose public, scanned images');
    return existing ? { ...d, status: 'DRAFT' } : { ...d, createdById: user.id };
  }
});
const Move = z.object({ action: z.enum(['submit', 'approve', 'return', 'schedule', 'published']), scheduledAt: z.coerce.date().optional(), urls: z.record(z.enum(CHANNELS), https).optional() });
@ApiTags('social')
@Controller('social-workflow')
export class SocialController implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly jobs: JobsService, private readonly notify: NotificationsService) {}
  onModuleInit() { this.jobs.register('social.due', (p: { id: string; at: string }) => this.due(p.id, p.at)); }
  @Post(':id/submit') @Can('social:update') @HttpCode(200)
  submit(@Param('id') sid: string) { return this.move(sid, ['DRAFT', 'FAILED'], { status: 'IN_REVIEW' }); }
  /** The author cannot approve their own post. */
  @Put(':id') @Can('social:manage')
  async act(@Param('id') sid: string, @ZBody(Move) b: z.infer<typeof Move>) {
    const u = requireUser();
    if (b.action === 'submit') return this.submit(sid);
    if (b.action === 'return') return this.move(sid, ['IN_REVIEW', 'APPROVED', 'SCHEDULED'], { status: 'DRAFT', scheduledAt: null, approvedAt: null, approvedById: null });
    if (b.action === 'approve') {
      const p = await this.prisma.socialPost.findFirst({ where: { id: sid } });
      if (p?.createdById === u.id) throw new BadRequestException('Someone else must approve your post');
      return this.move(sid, ['IN_REVIEW'], { status: 'APPROVED', approvedById: u.id, approvedAt: new Date() });
    }
    if (b.action === 'schedule') {
      if (!b.scheduledAt || b.scheduledAt < new Date()) throw new BadRequestException('Choose a time in the future');
      const r = await this.move(sid, ['APPROVED', 'SCHEDULED'], { status: 'SCHEDULED', scheduledAt: b.scheduledAt });
      await this.jobs.enqueue('social.due', { id: sid, at: b.scheduledAt.toISOString() }, { tenantId: requireTenant().id, runAt: b.scheduledAt });
      return r;
    }
    return this.move(sid, ['APPROVED', 'SCHEDULED'], { status: 'PUBLISHED', publishedAt: new Date(), publishedUrls: b.urls ?? {} });
  }
  private async move(sid: string, from: Prisma.SocialPostWhereInput['status'] extends never ? never : ('DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'FAILED')[], data: Prisma.SocialPostUncheckedUpdateManyInput) {
    const { count } = await this.prisma.socialPost.updateMany({ where: { id: sid, status: { in: from }, deletedAt: null }, data });
    if (!count) throw new BadRequestException('That step is not possible now');
    await this.audit.log('APPROVE', 'socialPost', sid, undefined, data);
    return { ok: true };
  }
  /** No network is connected yet, so at the scheduled time the approver is told to post it. Nothing is reported as published until someone confirms. */
  private async due(sid: string, at: string) {
    const p = await this.prisma.socialPost.findFirst({ where: { id: sid, status: 'SCHEDULED' } });
    if (!p || p.scheduledAt?.toISOString() !== at || !p.approvedById) return;
    await this.prisma.notification.create({ data: { tenantId: p.tenantId, userId: p.approvedById, channel: 'IN_APP', recipient: p.approvedById, subject: `Time to publish: ${p.title}`, content: `${p.channels.join(', ')}\n\n${p.body}`, status: 'DELIVERED', sentAt: new Date() } });
  }
}
@Module({ controllers: [PublicEventsController, EventDeskController, FeedbackController, SocialController, Events, Social] })
export class EngagementModule {}
