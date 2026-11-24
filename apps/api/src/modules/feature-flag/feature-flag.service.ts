/**
 * Feature Flag Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';
import { FeatureFlagType } from '@vashundhara-foundation/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

interface EvaluateContext {
  tenantId?: string;
  userId?: string;
  roles?: string[];
  country?: string;
  metadata?: Record<string, unknown>;
}

interface FeatureFlagWhereInput {
  deletedAt?: null | { not: null };
  isEnabled?: boolean;
  key?: string;
  tenantId?: string | null;
  OR?: Array<{ tenantId?: string | null }>;
}

@Injectable()
export class FeatureFlagService {
  private readonly CACHE_TTL = 60; // 1 minute
  private readonly CACHE_PREFIX = 'featureflag:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  async findAll(params: {
    tenantId?: string;
    isEnabled?: boolean;
    page?: number;
    limit?: number;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = params.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const { isEnabled, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: FeatureFlagWhereInput = { deletedAt: null };

    if (isEnabled !== undefined) where.isEnabled = isEnabled;

    if (!isSystemAdmin) {
      where.OR = [
        { tenantId: targetTenantId },
        { tenantId: null }
      ];
    } else if (targetTenantId) {
      where.OR = [
        { tenantId: targetTenantId },
        { tenantId: null }
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.prisma.featureFlag.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where,
        skip,
        take: limit,
        orderBy: [{ isEnabled: 'desc' }, { key: 'asc' }]
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.prisma.featureFlag.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const flag = await this.prisma.featureFlag.findUnique({
      where: { id, deletedAt: null }
    });

    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }

    return flag;
  }

  async findByKey(key: string, tenantId?: string) {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;

    const where: FeatureFlagWhereInput = { key, deletedAt: null };

    if (targetTenantId) {
      where.OR = [
        { tenantId: targetTenantId },
        { tenantId: null }
      ];
    } else {
      where.tenantId = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const flag = await this.prisma.featureFlag.findFirst({ where });

    if (!flag) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    return flag;
  }

  async evaluate(key: string, context: EvaluateContext, _defaultValue?: unknown): Promise<unknown> {
    const flag = await this.findByKey(key, context.tenantId);

    if (!flag.isEnabled) {
      return flag.defaultValue;
    }

    // Check targeting rules
    if (flag.targetingRules && !this.evaluateTargeting(flag.targetingRules, context)) {
      return flag.defaultValue;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100 && !this.isInRollout(context.userId || context.tenantId || '', flag.rolloutPercentage)) {
      return flag.defaultValue;
    }

    return flag.defaultValue;
  }

  async isEnabled(key: string, context: EvaluateContext, defaultValue = false): Promise<boolean> {
    const value = await this.evaluate(key, context, defaultValue);
    return Boolean(value);
  }

  async create(data: {
    key: string;
    name: string;
    description?: string;
    type: FeatureFlagType;
    defaultValue: unknown;
    isEnabled?: boolean;
    rolloutPercentage?: number;
    targetingRules?: Record<string, unknown>;
    tenantId?: string;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = data.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    if (!isSystemAdmin && targetTenantId && context?.tenantId !== targetTenantId) {
      throw new ForbiddenException('Cannot create flags for other tenants');
    }

    // Check uniqueness
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const existing = await this.prisma.featureFlag.findFirst({
      where: { key: data.key, tenantId: targetTenantId || null }
    });

    if (existing) {
      throw new ConflictException('Feature flag with this key already exists');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const flag = await this.prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        type: data.type,
        defaultValue: data.defaultValue,
        isEnabled: data.isEnabled || false,
        rolloutPercentage: data.rolloutPercentage || 0,
        targetingRules: data.targetingRules,
        tenantId: targetTenantId
      }
    });

    await this.invalidateCache(data.key, targetTenantId);
    return flag;
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    defaultValue?: unknown;
    isEnabled?: boolean;
    rolloutPercentage?: number;
    targetingRules?: Record<string, unknown>;
  }) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const flag = await this.findById(id);

    if (flag.tenantId && !isSystemAdmin && context?.tenantId !== flag.tenantId) {
      throw new ForbiddenException('Cannot update flags for other tenants');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data
    });

    await this.invalidateCache(updated.key, flag.tenantId || undefined);
    return updated;
  }

  async delete(id: string) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const flag = await this.findById(id);

    if (flag.tenantId && !isSystemAdmin && context?.tenantId !== flag.tenantId) {
      throw new ForbiddenException('Cannot delete flags for other tenants');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.prisma.featureFlag.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.invalidateCache(flag.key, flag.tenantId || undefined);
    return { success: true };
  }

  async toggle(key: string, tenantId?: string) {
    const flag = await this.findByKey(key, tenantId);
    return this.update(flag.id, { isEnabled: !flag.isEnabled });
  }

  async setRollout(key: string, percentage: number, tenantId?: string) {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    const flag = await this.findByKey(key, tenantId);
    return this.update(flag.id, { rolloutPercentage: percentage });
  }

  private evaluateTargeting(rules: Record<string, unknown>, context: EvaluateContext): boolean {
    if (rules.userIds && Array.isArray(rules.userIds)) {
      if (context.userId && !rules.userIds.includes(context.userId)) {
        return false;
      }
    }

    if (rules.roles && Array.isArray(rules.roles)) {
      const userRoles = context.roles || [];
      const hasRole = userRoles.some((r: string) => (rules.roles as string[]).includes(r));
      if (!hasRole) return false;
    }

    if (rules.countries && Array.isArray(rules.countries)) {
      // Would check context.country
    }

    if (rules.customAttributes && typeof rules.customAttributes === 'object') {
      for (const [attr, value] of Object.entries(rules.customAttributes)) {
        if (context.metadata?.[attr] !== value) return false;
      }
    }

    return true;
  }

  private isInRollout(identifier: string, percentage: number): boolean {
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % 100;
    return bucket < percentage;
  }

  private async invalidateCache(key: string, tenantId?: string) {
    const cacheKey = `${this.CACHE_PREFIX}${key}:${tenantId || 'global'}`;
    await this.redis.del(cacheKey);
  }
}