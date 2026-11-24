import { lookup } from 'dns/promises';
import * as https from 'https';
import { isIP } from 'net';
import { BadRequestException, Controller, Delete, Get, Injectable, NotFoundException, OnModuleInit, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, WebhookEvent } from '@prisma/client';
import { hmacSha256, randomToken } from '@vashundhara-foundation/auth';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { requireTenant } from '../../common/context/context';
import { Can, ZBody } from '../../common/http/decorators';
import { JobsService } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';

/** Refuses loopback, private, link-local, CGNAT, multicast and reserved addresses. */
export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPublicIp(mapped[1]);
    return /^[23]/.test(v) && !/^(2001:db8|2001:0?:|2002:)/.test(v);
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
}

/** Connects to the exact address that was checked, so DNS cannot change in between. Redirects are not followed. */
export async function safePost(url: string, body: string, headers: Record<string, string>, timeout = 10_000): Promise<{ status: number; body: string }> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || (u.port && u.port !== '443')) throw new BadRequestException('Use a plain https address');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicIp(a.address))) throw new BadRequestException('That address is not allowed');
  const { address, family } = addresses[0];
  return new Promise((resolve, reject) => {
    const req = https.request(u, {
      method: 'POST', headers: { ...headers, 'content-length': Buffer.byteLength(body) }, timeout, agent: false,
      lookup: (_h, opts, cb: any) => ((opts as { all?: boolean }).all ? cb(null, [{ address, family }]) : cb(null, address, family))
    }, (res) => {
      let text = '';
      res.on('data', (d: Buffer) => { if (text.length < 2000) text += d.toString(); else res.destroy(); });
      res.on('close', () => resolve({ status: res.statusCode ?? 0, body: text.slice(0, 2000) }));
    });
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
    req.end(body);
  });
}

@Injectable()
export class WebhooksService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService) {}
  onModuleInit() {
    this.jobs.register('webhook.deliver', (p: { deliveryId: string }) => this.deliver(p.deliveryId));
  }
  async emit(event: WebhookEvent, data: Prisma.InputJsonValue, tx: Pick<PrismaService, 'webhook' | 'webhookDelivery' | 'job'> = this.prisma) {
    const tenantId = requireTenant().id;
    const hooks = await tx.webhook.findMany({ where: { isActive: true, deletedAt: null, events: { has: event } } });
    for (const h of hooks) {
      const d = await tx.webhookDelivery.create({ data: { webhookId: h.id, event, payload: { event, createdAt: new Date().toISOString(), data } } });
      await this.jobs.enqueue('webhook.deliver', { deliveryId: d.id }, { tx, tenantId });
    }
  }
  private async deliver(id: string) {
    const d = await this.prisma.webhookDelivery.findUnique({ where: { id }, include: { webhook: true } });
    if (!d || d.status === 'COMPLETED' || !d.webhook.isActive || d.webhook.deletedAt || d.webhook.tenantId !== requireTenant().id) return;
    const body = JSON.stringify(d.payload);
    const t = Math.floor(Date.now() / 1000);
    try {
      const r = await safePost(d.webhook.url, body, { 'content-type': 'application/json', 'x-vf-event': d.event, 'x-vf-delivery': d.id, 'x-vf-signature': `t=${t},v1=${hmacSha256(`${t}.${body}`, d.webhook.secret)}` });
      const ok = r.status >= 200 && r.status < 300;
      await this.prisma.webhookDelivery.update({ where: { id }, data: { responseStatus: r.status, responseBody: r.body, status: ok ? 'COMPLETED' : 'RETRYING', attempt: { increment: 1 } } });
      if (!ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      await this.prisma.webhookDelivery.update({ where: { id }, data: { error: String((e as Error).message).slice(0, 300), status: 'FAILED' } });
      throw e;
    }
  }
}

const Schema = z.object({ name: z.string().min(1).max(80), url: z.url({ protocol: /^https$/ }).max(500), events: z.array(z.enum(WebhookEvent)).min(1), isActive: z.boolean().optional() });

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly prisma: PrismaService, private readonly hooks: WebhooksService, private readonly audit: AuditService, private readonly jobs: JobsService) {}
  @Get() @Can('webhooks:read')
  async list() { return { items: await this.prisma.webhook.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, omit: { secret: true } }) }; }
  @Post() @Can('webhooks:create')
  async create(@ZBody(Schema) b: z.infer<typeof Schema>) {
    const secret = `whsec_${randomToken(32)}`;
    const w = await this.prisma.webhook.create({ data: { ...b, secret, tenantId: requireTenant().id } });
    await this.audit.log('CREATE', 'webhook', w.id, undefined, b);
    return { id: w.id, secret };
  }
  @Put(':id') @Can('webhooks:update')
  async update(@Param('id') id: string, @ZBody(Schema.partial()) b: Partial<z.infer<typeof Schema>>) {
    await this.prisma.webhook.update({ where: { id }, data: b });
    await this.audit.log('UPDATE', 'webhook', id, undefined, b);
    return { ok: true };
  }
  @Delete(':id') @Can('webhooks:delete')
  async remove(@Param('id') id: string) {
    await this.prisma.webhook.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit.log('DELETE', 'webhook', id);
    return { ok: true };
  }
  @Get(':id/deliveries') @Can('webhooks:read')
  async deliveries(@Param('id') id: string) {
    if (!(await this.prisma.webhook.findFirst({ where: { id } }))) throw new NotFoundException('Webhook not found');
    return { items: await this.prisma.webhookDelivery.findMany({ where: { webhookId: id }, orderBy: { createdAt: 'desc' }, take: 50 }) };
  }
  @Post(':id/test') @Can('webhooks:update')
  async test(@Param('id') id: string) {
    const w = await this.prisma.webhook.findFirst({ where: { id, deletedAt: null } });
    if (!w) throw new NotFoundException('Webhook not found');
    const d = await this.prisma.webhookDelivery.create({ data: { webhookId: id, event: 'WEBHOOK_TEST', payload: { event: 'WEBHOOK_TEST', createdAt: new Date().toISOString(), data: {} } } });
    await this.jobs.enqueue('webhook.deliver', { deliveryId: d.id }, { tenantId: w.tenantId });
    return { deliveryId: d.id };
  }
}
