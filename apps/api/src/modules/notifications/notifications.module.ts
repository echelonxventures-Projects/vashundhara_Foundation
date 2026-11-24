import { Body, Controller, Get, Global, Inject, Injectable, Module, NotFoundException, OnModuleInit, Param, Post, Put } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import * as webpush from 'web-push';
import { z } from 'zod';
import { ENV, Env } from '../../env';
import { getCtx, requireTenant, requireUser, runAsSystem } from '../../common/context/context';
import { Can, PageQuery, Paging, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { JobsService, PermanentJobError } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';
import { crudController } from '../../common/crud/crud';
import { render, TEMPLATES, toHtml } from './templates';

export interface Notify {
  template: string;
  to: string;
  channel?: NotificationChannel;
  userId?: string | null;
  locale?: string;
  vars?: Record<string, unknown>;
  tx?: Pick<PrismaService, 'notification' | 'notificationTemplate' | 'job'>;
}

/** Links that carry sign-in tokens must not sit in the database in readable form after sending. */
const SENSITIVE = /^(auth\.|member\.invite|newsletter\.)/;

@Injectable()
export class NotificationsService implements OnModuleInit {
  private mailer?: nodemailer.Transporter;
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService, @Inject(ENV) private readonly env: Env) {
    if (env.SMTP_URL) this.mailer = nodemailer.createTransport(env.SMTP_URL);
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) webpush.setVapidDetails(env.APP_URL, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  }
  onModuleInit() {
    this.jobs.register('notification.send', ({ id }: { id: string }) => this.deliver(id));
  }

  async send(n: Notify) {
    const tenant = requireTenant();
    const db = n.tx ?? this.prisma;
    const channel = n.channel ?? 'EMAIL';
    const locale = (n.locale ?? tenant.defaultLocale) as any;
    const custom = await db.notificationTemplate.findFirst({
      where: { key: n.template, channel, isActive: true, locale: { in: [locale, 'en'] } },
      orderBy: [{ tenantId: { sort: 'asc', nulls: 'last' } }]
    });
    const fallback = TEMPLATES[n.template];
    if (!custom && !fallback) throw new Error(`Unknown template ${n.template}`);
    const vars = { org: tenant.displayName ?? tenant.name, ...n.vars };
    const row = await db.notification.create({
      data: {
        tenantId: tenant.id, channel, recipient: n.to, userId: n.userId ?? null, templateId: custom?.id,
        subject: render(custom?.subject ?? fallback?.subject ?? '', vars).replace(/[\r\n]+/g, ' '),
        content: render(custom?.content ?? fallback.body, vars),
        metadata: { template: n.template }
      }
    });
    if (channel === 'IN_APP') {
      await db.notification.update({ where: { id: row.id }, data: { status: 'DELIVERED', sentAt: new Date() } });
    } else {
      await this.jobs.enqueue('notification.send', { id: row.id }, { tx: n.tx, tenantId: tenant.id });
    }
    return row;
  }

  /** A notification is only marked SENT after the provider accepts it. */
  private async deliver(id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id } });
    if (!n || n.status === 'SENT' || n.status === 'DELIVERED') return;
    try {
      if (n.channel === 'EMAIL') await this.email(n.recipient, n.subject ?? '', n.content);
      else if (n.channel === 'SMS') await this.sms(n.recipient, n.content);
      else if (n.channel === 'PUSH') await this.push(n.userId, n.subject ?? '', n.content);
      else throw new PermanentJobError(`Channel ${n.channel} cannot be sent`);
      const template = (n.metadata as { template?: string }).template ?? '';
      await this.prisma.notification.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), ...(SENSITIVE.test(template) ? { content: '[removed after sending]' } : {}) }
      });
    } catch (e) {
      await this.prisma.notification.update({
        where: { id }, data: { status: 'FAILED', failedAt: new Date(), failureReason: String((e as Error).message).slice(0, 300), retryCount: { increment: 1 } }
      });
      throw e;
    }
  }

  private async email(to: string, subject: string, text: string) {
    if (!this.mailer) {
      if (this.env.NODE_ENV === 'production') throw new PermanentJobError('Email is not configured');
      if (this.env.NODE_ENV === 'development') console.log(JSON.stringify({ level: 'info', msg: 'dev email (not sent)', to, subject, text }));
      throw new PermanentJobError('Email is not configured (printed to the console in development)');
    }
    const t = requireTenant();
    const name = (t.displayName ?? t.name).replace(/["\r\n<>]/g, '');
    await this.mailer.sendMail({ from: `"${name}" <${this.env.EMAIL_FROM}>`, to, subject, text, html: toHtml(text) });
  }

  private async sms(to: string, text: string) {
    const { MSG91_AUTH_KEY: key, MSG91_SENDER_ID: sender, MSG91_TEMPLATE_ID: template } = this.env;
    if (!key || !template) throw new PermanentJobError('SMS is not configured');
    const r = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST', headers: { authkey: key, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ template_id: template, sender, recipients: [{ mobiles: to.replace(/\D/g, ''), message: text }] })
    });
    const body = (await r.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!r.ok || body.type === 'error') throw new Error(`MSG91: ${body.message ?? r.status}`);
  }

  private async push(userId: string | null, title: string, body: string) {
    if (!this.env.VAPID_PRIVATE_KEY) throw new PermanentJobError('Push is not configured');
    if (!userId) throw new PermanentJobError('Push needs a user');
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (!subs.length) throw new PermanentJobError('The user has no push device');
    let delivered = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body }));
        delivered++;
      } catch (e) {
        if ([404, 410].includes((e as { statusCode?: number }).statusCode ?? 0)) await this.prisma.pushSubscription.delete({ where: { id: s.id } });
      }
    }
    if (!delivered) throw new Error('No device accepted the push');
  }
}

const PushSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000).refine((u) => /(^|\.)(googleapis\.com|mozilla\.com|windows\.com|apple\.com)$/.test(new URL(u).hostname), 'Unknown push service'),
  p256dh: z.string().max(200), auth: z.string().max(100)
});

@Controller('me/notifications')
export class MyNotificationsController {
  constructor(private readonly prisma: PrismaService, @Inject(ENV) private readonly env: Env) {}
  @Get() @SelfService()
  async list(@ZQuery(PageQuery) p: Paging) {
    const where = { userId: requireUser().id, channel: 'IN_APP' as const };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, select: { id: true, subject: true, content: true, createdAt: true, deliveredAt: true } }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, deliveredAt: null } })
    ]);
    return { items, total, unread, page: p.page, limit: p.limit };
  }
  @Post('read') @SelfService()
  async read() {
    await this.prisma.notification.updateMany({ where: { userId: requireUser().id, channel: 'IN_APP', deliveredAt: null }, data: { deliveredAt: new Date() } });
    return { ok: true };
  }
  @Get('push-key') @SelfService()
  key() { return { key: this.env.VAPID_PUBLIC_KEY ?? null }; }
  @Put('push') @SelfService()
  async subscribe(@ZBody(PushSchema) b: z.infer<typeof PushSchema>) {
    const userId = requireUser().id;
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint: b.endpoint, userId } });
    await this.prisma.pushSubscription.create({ data: { ...b, userId, tenantId: requireTenant().id } });
    return { ok: true };
  }
}

const SendSchema = z.object({ channel: z.enum(['IN_APP', 'EMAIL']), membershipIds: z.array(z.uuid()).min(1).max(500), subject: z.string().min(1).max(200), body: z.string().min(1).max(5000) });

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService) {}
  @Get() @Can('notifications:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { content: true, contentHtml: true } }),
      this.prisma.notification.count()
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Post() @Can('notifications:create')
  async create(@ZBody(SendSchema) b: z.infer<typeof SendSchema>) {
    const tenantId = requireTenant().id;
    const members = await this.prisma.membership.findMany({ where: { id: { in: b.membershipIds }, status: 'ACTIVE' }, include: { user: { select: { id: true, email: true } } } });
    for (const m of members) {
      const inApp = b.channel === 'IN_APP';
      const n = await this.prisma.notification.create({ data: { tenantId, channel: b.channel, recipient: m.user.email, userId: m.userId, subject: b.subject.replace(/[\r\n]+/g, ' '), content: b.body, status: inApp ? 'DELIVERED' : 'PENDING', sentAt: inApp ? new Date() : null } });
      if (!inApp) await this.jobs.enqueue('notification.send', { id: n.id }, { tenantId });
    }
    return { sent: members.length };
  }
  @Post(':id/retry') @Can('notifications:manage')
  async retry(@Param('id') id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, status: 'FAILED' } });
    if (!n) throw new NotFoundException('Nothing to retry');
    await this.prisma.notification.update({ where: { id }, data: { status: 'PENDING' } });
    await this.jobs.enqueue('notification.send', { id }, { tenantId: n.tenantId });
    return { ok: true };
  }
}

const TemplatesController = crudController({
  path: 'notification-templates', resource: 'notifications', model: 'notificationTemplate', search: ['key', 'name'], filters: ['channel', 'locale'],
  schema: z.object({ key: z.enum(Object.keys(TEMPLATES) as [string, ...string[]]), name: z.string().min(1).max(100), channel: z.enum(['EMAIL', 'SMS', 'PUSH', 'IN_APP']), locale: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as', 'ur']).optional(), subject: z.string().max(200).optional(), content: z.string().min(1).max(5000), isActive: z.boolean().optional() }),
  only: ['list', 'get', 'create']
});

@Global()
@Module({ providers: [NotificationsService], controllers: [MyNotificationsController, NotificationsController, TemplatesController], exports: [NotificationsService] })
export class NotificationsModule {}
