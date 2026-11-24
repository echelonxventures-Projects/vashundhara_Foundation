/**
 * Notification Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';
import { NotificationChannel } from '@vashundhara-foundation/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Notification type definitions
interface Notification {
  id: string;
  templateId: string | null;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  content: string;
  contentHtml: string | null;
  priority: number;
  scheduledAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  nextRetryAt: Date | null;
  failureReason: string | null;
  retryCount: number;
  maxRetries: number | null;
  status: string;
  metadata: Prisma.InputJsonValue;
  tenantId: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface NotificationWhereInput {
  deletedAt?: null | { not: null };
  tenantId?: string;
  userId?: string;
  channel?: NotificationChannel;
  status?: string;
  templateId?: string;
  createdAt?: { gte?: Date; lte?: Date };
}

interface NotificationTemplate {
  id: string;
  key: string;
  name: string;
  subject: string | null;
  content: string;
  contentHtml: string | null;
  channel: NotificationChannel;
  tenantId: string | null;
}

@Injectable()
export class NotificationService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'notification:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  async findAll(params: {
    tenantId?: string;
    userId?: string;
    channel?: NotificationChannel;
    status?: string;
    templateId?: string;
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = params.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const {
      userId,
      channel,
      status,
      templateId,
      page = 1,
      limit = 50,
      startDate,
      endDate
    } = params;
    const skip = (page - 1) * limit;

    const where: NotificationWhereInput = { deletedAt: null };

    if (!isSystemAdmin) {
      where.tenantId = targetTenantId;
    } else if (targetTenantId) {
      where.tenantId = targetTenantId;
    }

    if (userId) where.userId = userId;
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (templateId) where.templateId = templateId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.prisma.notification.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          template: { select: { id: true, key: true, name: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.prisma.notification.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        template: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } }
      }
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async create(data: {
    templateId?: string;
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    content: string;
    contentHtml?: string;
    priority?: number;
    scheduledAt?: Date;
    metadata?: Record<string, unknown>;
    userId?: string;
  }) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // If template provided, use it to fill in missing fields
    let subject = data.subject;
    let content = data.content;
    let contentHtml = data.contentHtml;

    if (data.templateId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id: data.templateId }
      });

      if (template) {
        subject = subject || template.subject || '';
        content = content || template.content;
        contentHtml = contentHtml || template.contentHtml || undefined;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const notification = await this.prisma.notification.create({
      data: {
        templateId: data.templateId,
        channel: data.channel,
        recipient: data.recipient,
        subject,
        content,
        contentHtml,
        priority: data.priority || 0,
        scheduledAt: data.scheduledAt,
        metadata: data.metadata as Prisma.InputJsonValue || {},
        tenantId,
        userId: data.userId,
        status: 'PENDING'
      }
    });

    // If not scheduled, queue for sending
    if (!data.scheduledAt) {
      this.queueNotification(notification.id);
    }

    return notification;
  }

  async sendNotification(id: string) {
    const notification = await this.findById(id);

    if (notification.status === 'SENT' || notification.status === 'DELIVERED') {
      throw new Error('Notification already sent');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.prisma.notification.update({
      where: { id },
      data: { status: 'PROCESSING' }
    });

    try {
      // Send based on channel
      switch (notification.channel) {
        case 'EMAIL':
          this.sendEmail(notification);
          break;
        case 'SMS':
          this.sendSMS(notification);
          break;
        case 'PUSH':
          this.sendPush(notification);
          break;
        case 'IN_APP':
          this.sendInApp(notification);
          break;
        case 'WEBHOOK':
          this.sendWebhook(notification);
          break;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.notification.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          retryCount: 0
        }
      });

      return { success: true };
    } catch (error) {
      await this.handleFailure(notification, error);
      throw error;
    }
  }

  async retryFailed(limit = 100) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const failed = await this.prisma.notification.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 3 },
        deletedAt: null
      },
      take: limit
    });

    const results = await Promise.allSettled(
      failed.map((n: Notification) => this.sendNotification(n.id))
    );

    return {
      total: failed.length,
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }

  private queueNotification(notificationId: string): void {
    // In production, this would use a message queue (RabbitMQ, etc.)
    // For now, we'll just process it immediately
    setImmediate(() => {
      void this.sendNotification(notificationId).catch(console.error);
    });
  }

  private sendEmail(notification: Notification): void {
    // Integration with email service (SendGrid, Mailgun, SES, etc.)
    console.log(`Sending email to ${notification.recipient}: ${notification.subject}`);
    // await emailService.send({ to: notification.recipient, subject: notification.subject, html: notification.contentHtml || notification.content });
  }

  private sendSMS(notification: Notification): void {
    // Integration with SMS service (Twilio, MSG91, etc.)
    console.log(`Sending SMS to ${notification.recipient}: ${notification.content}`);
  }

  private sendPush(notification: Notification): void {
    // Integration with push service (Firebase, etc.)
    console.log(`Sending push to ${notification.recipient}: ${notification.subject}`);
  }

  private sendInApp(notification: Notification): void {
    // In-app notifications are just stored in DB
    console.log(`Creating in-app notification for ${notification.recipient}`);
  }

  private sendWebhook(notification: Notification): void {
    // Send to webhook URL
    console.log(`Sending webhook to ${notification.recipient}`);
  }

  private async handleFailure(notification: Notification, error: unknown) {
    const retryCount = notification.retryCount + 1;
    const maxRetries = notification.maxRetries || 3;

    if (retryCount >= maxRetries) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Unknown error',
          retryCount
        }
      });
    } else {
      // Schedule retry with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, retryCount), 300000); // Max 5 min
      const nextRetryAt = new Date(Date.now() + delayMs);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          retryCount,
          nextRetryAt,
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}