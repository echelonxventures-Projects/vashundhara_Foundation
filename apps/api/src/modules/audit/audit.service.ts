/**
 * Audit Service for Vashundhara Foundation API
 */

import { Injectable, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';
import { AuditAction } from '@vashundhara-foundation/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

interface AuditLogInclude {
  user?: { select: { id: true; email: true; firstName: true; lastName: true } };
  tenant?: { select: { id: true; name: true; slug: true } };
}

interface AuditLogFindManyArgs {
  where: Prisma.AuditLogWhereInput;
  skip?: number;
  take?: number;
  orderBy: Record<string, 'asc' | 'desc'>;
  include?: AuditLogInclude | null;
}

interface AuditLogWhereInput {
  deletedAt?: null | { not: null };
  tenantId?: string;
  userId?: string;
  resource?: string;
  action?: AuditAction;
  resourceId?: string;
  createdAt?: { gte?: Date; lte?: Date };
}

interface GroupByResult {
  action?: string;
  resource?: string;
  userId?: string;
  _count: number;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    auditLog: {
      findMany: (args: AuditLogFindManyArgs) => Promise<unknown[]>;
      findUnique: (args: { where: { id: string } }) => Promise<unknown>;
      count: (args: { where: Prisma.AuditLogWhereInput }) => Promise<number>;
      groupBy: (args: { by: string[]; where: Prisma.AuditLogWhereInput; _count: boolean; take?: number; orderBy?: Record<string, unknown> }) => Promise<GroupByResult[]>;
    };
  } {
    return this.prisma as PrismaService & {
      auditLog: {
        findMany: (args: AuditLogFindManyArgs) => Promise<unknown[]>;
        findUnique: (args: { where: { id: string } }) => Promise<unknown>;
        count: (args: { where: Prisma.AuditLogWhereInput }) => Promise<number>;
        groupBy: (args: { by: string[]; where: Prisma.AuditLogWhereInput; _count: boolean; take?: number; orderBy?: Record<string, unknown> }) => Promise<GroupByResult[]>;
      };
    };
  }

  async findAll(params: {
    tenantId?: string;
    userId?: string;
    resource?: string;
    action?: AuditAction;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = params.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    if (!targetTenantId && !isSystemAdmin) {
      throw new ForbiddenException('Tenant context required');
    }

    const {
      userId,
      resource,
      action,
      resourceId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;
    const skip = (page - 1) * limit;

    const where: AuditLogWhereInput = { deletedAt: null };

    if (!isSystemAdmin) {
      where.tenantId = targetTenantId;
    } else if (targetTenantId) {
      where.tenantId = targetTenantId;
    }

    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (action) where.action = action;
    if (resourceId) where.resourceId = resourceId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.auditLog.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: where as Prisma.AuditLogWhereInput,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.auditLog.count({ where: where as Prisma.AuditLogWhereInput })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    const log = await typedPrisma.auditLog.findUnique({ where: { id } });
    if (!log) {
      throw new Error('Audit log not found');
    }
    return log;
  }

  async getResourceHistory(resource: string, resourceId: string, tenantId?: string) {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const where: AuditLogWhereInput = { resource, resourceId };
    if (!isSystemAdmin) where.tenantId = targetTenantId;
    else if (targetTenantId) where.tenantId = targetTenantId;

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return typedPrisma.auditLog.findMany(
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: where as Prisma.AuditLogWhereInput,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }
    );
  }

  async getUserActivity(userId: string, tenantId?: string, limit = 100) {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const where: AuditLogWhereInput = { userId };
    if (!isSystemAdmin) where.tenantId = targetTenantId;
    else if (targetTenantId) where.tenantId = targetTenantId;

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return typedPrisma.auditLog.findMany(
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: where as Prisma.AuditLogWhereInput,
        orderBy: { createdAt: 'desc' },
        take: limit
      }
    );
  }

  async getStats(tenantId?: string, startDate?: Date, endDate?: Date) {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const where: AuditLogWhereInput = { deletedAt: null };
    if (!isSystemAdmin) where.tenantId = targetTenantId;
    else if (targetTenantId) where.tenantId = targetTenantId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [totalLogs, byAction, byResource, byUser] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.auditLog.count({ where: where as Prisma.AuditLogWhereInput }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.auditLog.groupBy({ by: ['action'], where: where as Prisma.AuditLogWhereInput, _count: true }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.auditLog.groupBy({ by: ['resource'], where: where as Prisma.AuditLogWhereInput, _count: true }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.auditLog.groupBy({ by: ['userId'], where: where as Prisma.AuditLogWhereInput, _count: true, take: 10, orderBy: { _count: { userId: 'desc' } } })
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    return {
      totalLogs,
      byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
      byResource: byResource.map((r) => ({ resource: r.resource, count: r._count })),
      topUsers: byUser.map((u) => ({ userId: u.userId, count: u._count }))
    };
  }

  async exportLogs(params: {
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
    resource?: string;
    action?: AuditAction;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = params.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const where: AuditLogWhereInput = { deletedAt: null };
    if (!isSystemAdmin) where.tenantId = targetTenantId;
    else if (targetTenantId) where.tenantId = targetTenantId;

    if (params.resource) where.resource = params.resource;
    if (params.action) where.action = params.action;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return typedPrisma.auditLog.findMany(
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: where as Prisma.AuditLogWhereInput,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          tenant: { select: { id: true, name: true, slug: true } }
        }
      }
    );
  }
}