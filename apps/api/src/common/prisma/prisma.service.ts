/**
 * Prisma Service with Multi-tenancy Support
 * Implements Row Level Security (RLS) via middleware
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { TenantContext } from '@vashundhara-foundation/shared';
import type { Prisma } from '@vashundhara-foundation/database';

import { TenantContextService } from '../../tenant/tenant-context.service';

// Define middleware params type for current Prisma version
interface PrismaMiddlewareParams {
  model?: string;
  action: string;
  args: Record<string, unknown>;
  runInTransaction: boolean;
}

// Generic model delegate interface with proper typing
interface PrismaModelDelegate {
  findUnique<T = Record<string, unknown>>(args: { where: Record<string, unknown>; include?: Record<string, unknown>; select?: Record<string, unknown> }): Promise<T | null>;
  findFirst<T = Record<string, unknown>>(args: { where: Record<string, unknown>; include?: Record<string, unknown>; select?: Record<string, unknown>; orderBy?: Record<string, unknown> }): Promise<T | null>;
  findMany<T = Record<string, unknown>>(args: { where?: Record<string, unknown>; include?: Record<string, unknown>; select?: Record<string, unknown>; orderBy?: Record<string, unknown>; skip?: number; take?: number }): Promise<T[]>;
  create<T = Record<string, unknown>>(args: { data: Record<string, unknown>; include?: Record<string, unknown>; select?: Record<string, unknown> }): Promise<T>;
  createMany(args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update<T = Record<string, unknown>>(args: { where: Record<string, unknown>; data: Record<string, unknown>; include?: Record<string, unknown>; select?: Record<string, unknown> }): Promise<T>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  delete<T = Record<string, unknown>>(args: { where: Record<string, unknown> }): Promise<T>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  count(args: { where?: Record<string, unknown> }): Promise<number>;
  groupBy(args: { by: string[]; where?: Record<string, unknown>; _count?: boolean | Record<string, unknown>; orderBy?: Record<string, unknown>; take?: number }): Promise<Record<string, unknown>[]>;
  aggregate(args: { where?: Record<string, unknown>; _count?: Record<string, unknown>; _avg?: Record<string, unknown>; _sum?: Record<string, unknown>; _min?: Record<string, unknown>; _max?: Record<string, unknown> }): Promise<Record<string, unknown>>;
}

// Extended PrismaClient with typed model delegates
interface ExtendedPrismaClient extends PrismaClient {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $use: (middleware: (params: PrismaMiddlewareParams, next: (params: PrismaMiddlewareParams) => Promise<unknown>) => Promise<unknown>) => void;
  $on: (event: string, listener: (event: unknown) => void) => void;
  auditLog: PrismaModelDelegate;
  user: PrismaModelDelegate;
  tenant: PrismaModelDelegate;
  role: PrismaModelDelegate;
  permission: PrismaModelDelegate;
  tenantConfig: PrismaModelDelegate;
  featureFlag: PrismaModelDelegate;
  currency: PrismaModelDelegate;
  exchangeRate: PrismaModelDelegate;
  file: PrismaModelDelegate;
  session: PrismaModelDelegate;
  apiKey: PrismaModelDelegate;
  notification: PrismaModelDelegate;
  notificationTemplate: PrismaModelDelegate;
  webhook: PrismaModelDelegate;
  webhookDelivery: PrismaModelDelegate;
  translation: PrismaModelDelegate;
  rolePermission: PrismaModelDelegate;
  userRole: PrismaModelDelegate;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly tenantContext: TenantContextService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
      errorFormat: 'pretty'
    } as PrismaClient['constructor']['prototype']['constructor'] extends (options: infer O) => unknown ? O : never);
  }

  // Type assertion helper to access typed model delegates
  private get typed(): ExtendedPrismaClient {
    return this as unknown as ExtendedPrismaClient;
  }

  async onModuleInit(): Promise<void> {
    await this.typed.$connect();

    // Add multi-tenancy middleware
    this.typed.$use(this.tenantMiddleware());

    // Add soft delete middleware
    this.typed.$use(this.softDeleteMiddleware());

    // Add audit middleware
    this.typed.$use(this.auditMiddleware());
  }

  async onModuleDestroy(): Promise<void> {
    await this.typed.$disconnect();
  }

  /**
   * Multi-tenancy Middleware
   * Automatically adds tenant_id filter to all queries
   */
  private tenantMiddleware() {
    return async (params: PrismaMiddlewareParams, next: (params: PrismaMiddlewareParams) => Promise<unknown>) => {
      const context = this.tenantContext.getContext();

      // Skip tenant filtering for system-level operations
      if (context?.isSystemAdmin) {
        return next(params);
      }

      // Skip for models that don't have tenantId
      const tenantModels = [
        'User', 'Role', 'Permission', 'RolePermission', 'UserRole',
        'TenantConfig', 'FeatureFlag', 'Currency', 'ExchangeRate',
        'Translation', 'AuditLog', 'Notification', 'NotificationTemplate',
        'Webhook', 'WebhookDelivery', 'File', 'Session', 'ApiKey'
      ];

      if (!tenantModels.includes(params.model || '') || !context?.tenantId) {
        return next(params);
      }

      // Add tenant filter to queries
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.args.where = {
          ...(params.args.where as Record<string, unknown>),
          tenantId: context.tenantId
        };
      }

      if (params.action === 'findMany') {
        params.args.where = {
          ...(params.args.where as Record<string, unknown>),
          tenantId: context.tenantId
        };
      }

      if (params.action === 'create' || params.action === 'createMany') {
        if (params.args.data) {
          const data = params.args.data as Record<string, unknown> | Record<string, unknown>[];
          if (Array.isArray(data)) {
            params.args.data = data.map((d: Record<string, unknown>) => ({
              ...d,
              tenantId: context.tenantId
            }));
          } else {
            params.args.data = {
              ...data,
              tenantId: context.tenantId
            };
          }
        }
      }

      if (params.action === 'update' || params.action === 'updateMany') {
        params.args.where = {
          ...(params.args.where as Record<string, unknown>),
          tenantId: context.tenantId
        };
      }

      if (params.action === 'delete' || params.action === 'deleteMany') {
        params.args.where = {
          ...(params.args.where as Record<string, unknown>),
          tenantId: context.tenantId
        };
      }

      return next(params);
    };
  }

  /**
   * Soft Delete Middleware
   * Automatically filters out deleted records and sets deletedAt on delete
   */
  private softDeleteMiddleware() {
    return async (params: PrismaMiddlewareParams, next: (params: PrismaMiddlewareParams) => Promise<unknown>) => {
      const softDeleteModels = [
        'User', 'Tenant', 'Role', 'FeatureFlag', 'Currency',
        'Translation', 'Notification', 'Webhook', 'File'
      ];

      if (!softDeleteModels.includes(params.model || '')) {
        return next(params);
      }

      // Filter out deleted records in read operations
      if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
        params.args.where = {
          ...(params.args.where as Record<string, unknown>),
          deletedAt: null
        };
      }

      // Soft delete instead of hard delete
      if (params.action === 'delete') {
        params.action = 'update';
        params.args.data = {
          deletedAt: new Date()
        };
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        params.args.data = {
          deletedAt: new Date()
        };
      }

      return next(params);
    };
  }

  /**
   * Audit Middleware
   * Logs changes for auditable models
   */
  private auditMiddleware() {
    return async (params: PrismaMiddlewareParams, next: (params: PrismaMiddlewareParams) => Promise<unknown>) => {
      const auditableModels = [
        'User', 'Tenant', 'Role', 'Permission', 'TenantConfig',
        'FeatureFlag', 'Currency', 'ExchangeRate'
      ];

      const isAuditable = auditableModels.includes(params.model || '');
      const isWriteOperation = ['create', 'update', 'delete', 'updateMany', 'deleteMany'].includes(params.action);

      if (!isAuditable || !isWriteOperation) {
        return next(params);
      }

      const context = this.tenantContext.getContext();
      const beforeData = params.action === 'update' || params.action === 'delete'
        ? await this.getRecordBeforeChange(params.model!, params.args.where)
        : null;

      const result = await next(params);

      // Log audit entry (fire and forget)
      this.logAudit(params, context, beforeData, result).catch(console.error);

      return result;
    };
  }

  private async getRecordBeforeChange(model: string, where: unknown): Promise<Record<string, unknown> | null> {
    try {
      const delegate = this.typed[model.toLowerCase()] as PrismaModelDelegate | undefined;
      if (delegate?.findUnique) {
        return await delegate.findUnique({ where: where as Record<string, unknown> });
      }
      return null;
    } catch {
      return null;
    }
  }

  private async logAudit(
    params: PrismaMiddlewareParams,
    context: TenantContext | undefined,
    beforeData: Record<string, unknown> | null,
    afterData: unknown
  ): Promise<void> {
    if (!context?.tenantId) return;

    const actionMap: Record<string, string> = {
      create: 'CREATE',
      update: 'UPDATE',
      delete: 'DELETE'
    };

    const auditLogDelegate = this.typed.auditLog as PrismaModelDelegate | undefined;
    if (auditLogDelegate?.create) {
      const afterDataRecord = afterData as Record<string, unknown> | undefined;
      const beforeDataRecord = beforeData as Record<string, unknown> | undefined;
      await auditLogDelegate.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: actionMap[params.action] || params.action.toUpperCase(),
          resource: params.model!,
          resourceId: (afterDataRecord?.id as string) || (beforeDataRecord?.id as string),
          oldValues: beforeDataRecord,
          newValues: afterDataRecord,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      });
    }
  }

  /**
   * Clean up soft-deleted records (for maintenance)
   */
  async hardDeleteOldRecords(olderThanDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const models = ['User', 'Tenant', 'Role', 'FeatureFlag', 'File'];

    for (const model of models) {
      try {
        const delegate = this.typed[model.toLowerCase()] as PrismaModelDelegate | undefined;
        if (delegate?.deleteMany) {
          await delegate.deleteMany({
            where: {
              deletedAt: { lt: cutoffDate }
            }
          });
        }
      } catch (error) {
        console.error(`Failed to hard delete ${model}:`, error);
      }
    }
  }
}