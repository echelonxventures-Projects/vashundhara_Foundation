/**
 * Webhook Service for Vashundhara Foundation API
 * Handles webhook registration, delivery, and retry logic
 */

import { createHmac, randomBytes } from 'crypto';

import {
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';
import { WebhookEvent } from '@vashundhara-foundation/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Webhook type definitions
export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  headers: Record<string, string>;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface WebhookWhereInput {
  deletedAt?: null | { not: null };
  tenantId?: string;
  isActive?: boolean;
  events?: { has: WebhookEvent };
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: unknown;
  responseStatus: number;
  responseBody: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  attempt: number;
  error: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
}

interface WebhookDeliveryWhereInput {
  webhookId?: string;
  status?: string;
  attempt?: { lt: number };
}

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    webhook: {
      findMany<T = Webhook[]>(args: { where?: WebhookWhereInput; skip?: number; take?: number; orderBy?: Prisma.WebhookOrderByWithRelationInput }): Promise<T>;
      count(args: { where?: WebhookWhereInput }): Promise<number>;
      findUnique<T = Webhook | null>(args: { where: Prisma.WebhookWhereUniqueInput }): Promise<T>;
      create<T = Webhook>(args: { data: Prisma.WebhookCreateInput }): Promise<T>;
      update<T = Webhook>(args: { where: Prisma.WebhookWhereUniqueInput; data: Prisma.WebhookUpdateInput }): Promise<T>;
    };
    webhookDelivery: {
      create<T = WebhookDelivery>(args: { data: Prisma.WebhookDeliveryCreateInput }): Promise<T>;
      findMany<T = WebhookDelivery[]>(args: { where?: WebhookDeliveryWhereInput; take?: number; orderBy?: Prisma.WebhookDeliveryOrderByWithRelationInput }): Promise<T>;
      update<T = WebhookDelivery>(args: { where: Prisma.WebhookDeliveryWhereUniqueInput; data: Prisma.WebhookDeliveryUpdateInput }): Promise<T>;
    };
  } {
    return this.prisma as PrismaService & {
      webhook: {
        findMany<T = Webhook[]>(args: { where?: WebhookWhereInput; skip?: number; take?: number; orderBy?: Prisma.WebhookOrderByWithRelationInput }): Promise<T>;
        count(args: { where?: WebhookWhereInput }): Promise<number>;
        findUnique<T = Webhook | null>(args: { where: Prisma.WebhookWhereUniqueInput }): Promise<T>;
        create<T = Webhook>(args: { data: Prisma.WebhookCreateInput }): Promise<T>;
        update<T = Webhook>(args: { where: Prisma.WebhookWhereUniqueInput; data: Prisma.WebhookUpdateInput }): Promise<T>;
      };
      webhookDelivery: {
        create<T = WebhookDelivery>(args: { data: Prisma.WebhookDeliveryCreateInput }): Promise<T>;
        findMany<T = WebhookDelivery[]>(args: { where?: WebhookDeliveryWhereInput; take?: number; orderBy?: Prisma.WebhookDeliveryOrderByWithRelationInput }): Promise<T>;
        update<T = WebhookDelivery>(args: { where: Prisma.WebhookDeliveryWhereUniqueInput; data: Prisma.WebhookDeliveryUpdateInput }): Promise<T>;
      };
    };
  }

  async findAll(params: {
    tenantId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = params.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const { isActive, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: WebhookWhereInput = { deletedAt: null };

    if (!isSystemAdmin) {
      where.tenantId = targetTenantId;
    } else if (targetTenantId) {
      where.tenantId = targetTenantId;
    }

    if (isActive !== undefined) where.isActive = isActive;

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.webhook.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.webhook.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const webhook = await typedPrisma.webhook.findUnique({
      where: { id, deletedAt: null }
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return webhook;
  }

  async create(data: {
    name: string;
    url: string;
    events: WebhookEvent[];
    secret?: string;
    isActive?: boolean;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    headers?: Record<string, string>;
    tenantId?: string;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = data.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    if (!isSystemAdmin && targetTenantId && context?.tenantId !== targetTenantId) {
      throw new ForbiddenException('Cannot create webhooks for other tenants');
    }

    const secret = data.secret || randomBytes(32).toString('hex');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const webhook = await this.prisma.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        secret,
        events: data.events,
        isActive: data.isActive ?? true,
        timeoutMs: data.timeoutMs ?? 30000,
        maxRetries: data.maxRetries ?? 3,
        retryDelayMs: data.retryDelayMs ?? 1000,
        headers: data.headers || {},
        tenant: targetTenantId ? { connect: { id: targetTenantId } } : undefined
      }
    });

    return webhook;
  }

  async update(id: string, data: Partial<{
    name: string;
    url: string;
    events: WebhookEvent[];
    secret: string;
    isActive: boolean;
    timeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
    headers: Record<string, string>;
  }>) {
    const webhook = await this.findById(id);

    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    if (!isSystemAdmin && webhook.tenantId && context?.tenantId !== webhook.tenantId) {
      throw new ForbiddenException('Cannot update webhooks for other tenants');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    return this.prisma.webhook.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    const webhook = await this.findById(id);

    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    if (!isSystemAdmin && webhook.tenantId && context?.tenantId !== webhook.tenantId) {
      throw new ForbiddenException('Cannot delete webhooks for other tenants');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    return this.prisma.webhook.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async testDelivery(id: string) {
    const webhook = await this.findById(id);

    const testPayload = {
      event: 'WEBHOOK_TEST',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' }
    };

    // Use a valid WebhookEvent type for test
    return this.deliver(webhook, 'TENANT_CREATED' as WebhookEvent, testPayload);
  }

  async deliver(webhook: Webhook, event: WebhookEvent, payload: unknown) {
    const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event,
      'X-Webhook-Delivery': randomBytes(16).toString('hex'),
      ...webhook.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: payload as Prisma.InputJsonValue,
          responseStatus: response.status,
          responseBody: await response.text().catch(() => ''),
          status: response.ok ? 'COMPLETED' : 'FAILED',
          attempt: 1
        }
      });

      if (!response.ok) {
        await this.scheduleRetry(webhook, delivery, 1);
      }

      return delivery;
    } catch (error) {
      clearTimeout(timeoutId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: payload as Prisma.InputJsonValue,
          responseStatus: 0,
          responseBody: error instanceof Error ? error.message : 'Unknown error',
          status: 'FAILED',
          attempt: 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      await this.scheduleRetry(webhook, delivery, 1);
      return delivery;
    }
  }

  async triggerEvent(event: WebhookEvent, payload: unknown, tenantId?: string) {
    const where: WebhookWhereInput = { events: { has: event }, isActive: true, deletedAt: null };
    if (tenantId) where.tenantId = tenantId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const webhooks = await this.prisma.webhook.findMany({ where });

    return Promise.all(
      webhooks.map((webhook: Webhook) => this.deliver(webhook, event, payload))
    );
  }

  async retryFailed(webhookId: string, limit = 50) {
    const webhook = await this.findById(webhookId);
    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const failed = await typedPrisma.webhookDelivery.findMany({
      where: {
        webhookId,
        status: 'FAILED',
        attempt: { lt: webhook.maxRetries }
      },
      take: limit,
      orderBy: { createdAt: 'asc' }
    });

    const results = await Promise.allSettled(
      failed.map((delivery: WebhookDelivery) => this.retryDelivery(webhook, delivery))
    );

    return {
      total: failed.length,
      succeeded: results.filter((r: PromiseSettledResult<unknown>) => r.status === 'fulfilled').length,
      failed: results.filter((r: PromiseSettledResult<unknown>) => r.status === 'rejected').length
    };
  }

  private async retryDelivery(webhook: Webhook, delivery: WebhookDelivery) {
    const newAttempt = delivery.attempt + 1;
    const delay = webhook.retryDelayMs * Math.pow(2, delivery.attempt - 1);

    await new Promise(resolve => setTimeout(resolve, delay));

    const result = await this.deliver(webhook, delivery.event, delivery.payload);

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.status,
        attempt: newAttempt,
        nextRetryAt: newAttempt < webhook.maxRetries && result.status === 'FAILED'
          ? new Date(Date.now() + delay)
          : null
      }
    });

    return result;
  }

  private async scheduleRetry(webhook: Webhook, delivery: WebhookDelivery, attempt: number) {
    if (attempt >= webhook.maxRetries) return;

    const delay = webhook.retryDelayMs * Math.pow(2, attempt - 1);
    const nextRetryAt = new Date(Date.now() + delay);

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { nextRetryAt }
    });

    // In production, use a proper job queue (BullMQ, etc.)
    // For now, schedule with setTimeout
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    setTimeout(() => { void this.retryDelivery(webhook, delivery).catch(console.error); }, delay);
  }

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }
}