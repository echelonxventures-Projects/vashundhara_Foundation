/**
 * Config Service for Vashundhara Foundation API
 * Handles system and tenant configuration with caching
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Type definitions for config
export interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  category: string;
  isPublic: boolean;
  isEditable: boolean;
  validationSchema?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantConfig {
  id: string;
  tenantId: string;
  key: string;
  value: unknown;
  description?: string;
  category: string;
  isOverridden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ConfigSetOptions {
  description?: string;
  category?: string;
  isPublic?: boolean;
  isEditable?: boolean;
  validationSchema?: Record<string, unknown>;
}

interface TenantConfigSetOptions {
  description?: string;
  category?: string;
}

interface ValidationSchema {
  type?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

@Injectable()
export class ConfigService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'config:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    systemConfig: {
      findMany<T = SystemConfig[]>(args: { where?: Prisma.SystemConfigWhereInput; orderBy?: Prisma.SystemConfigOrderByWithRelationInput[] }): Promise<T>;
      findUnique<T = SystemConfig | null>(args: { where: { key: string } }): Promise<T>;
      upsert<T = SystemConfig>(args: { where: { key: string }; update: Prisma.SystemConfigUpdateInput; create: Prisma.SystemConfigCreateInput }): Promise<T>;
      delete(args: { where: { key: string } }): Promise<{ id: string }>;
    };
    tenantConfig: {
      findMany<T = TenantConfig[]>(args: { where?: Prisma.TenantConfigWhereInput }): Promise<T>;
      findUnique<T = TenantConfig | null>(args: { where: { tenantId_key: { tenantId: string; key: string } } }): Promise<T>;
      upsert<T = TenantConfig>(args: { where: { tenantId_key: { tenantId: string; key: string } }; update: Prisma.TenantConfigUpdateInput; create: Prisma.TenantConfigCreateInput }): Promise<T>;
      delete(args: { where: { tenantId_key: { tenantId: string; key: string } } }): Promise<{ id: string }>;
    };
  } {
    return this.prisma as PrismaService & {
      systemConfig: {
        findMany<T = SystemConfig[]>(args: { where?: Prisma.SystemConfigWhereInput; orderBy?: Prisma.SystemConfigOrderByWithRelationInput[] }): Promise<T>;
        findUnique<T = SystemConfig | null>(args: { where: { key: string } }): Promise<T>;
        upsert<T = SystemConfig>(args: { where: { key: string }; update: Prisma.SystemConfigUpdateInput; create: Prisma.SystemConfigCreateInput }): Promise<T>;
        delete(args: { where: { key: string } }): Promise<{ id: string }>;
      };
      tenantConfig: {
        findMany<T = TenantConfig[]>(args: { where?: Prisma.TenantConfigWhereInput }): Promise<T>;
        findUnique<T = TenantConfig | null>(args: { where: { tenantId_key: { tenantId: string; key: string } } }): Promise<T>;
        upsert<T = TenantConfig>(args: { where: { tenantId_key: { tenantId: string; key: string } }; update: Prisma.TenantConfigUpdateInput; create: Prisma.TenantConfigCreateInput }): Promise<T>;
        delete(args: { where: { tenantId_key: { tenantId: string; key: string } } }): Promise<{ id: string }>;
      };
    };
  }

  // ============================================
  // System Config (Global defaults)
  // ============================================

  async getSystemConfigs(category?: string): Promise<SystemConfig[]> {
    const typedPrisma = this.getTypedPrisma();
    const where: Prisma.SystemConfigWhereInput = {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (category) where.category = category;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const configs = await typedPrisma.systemConfig.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }]
    });

    return configs;
  }

  async getSystemConfig(key: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const config = await typedPrisma.systemConfig.findUnique({ where: { key } });
    if (!config) {
      throw new NotFoundException(`System config ${key} not found`);
    }
    return config;
  }

  setSystemConfig(key: string, value: unknown, options?: ConfigSetOptions) {
    const typedPrisma = this.getTypedPrisma();
    const updateData = {
      value: value as Prisma.InputJsonValue,
      description: options?.description,
      category: options?.category,
      isPublic: options?.isPublic,
      isEditable: options?.isEditable,
      validationSchema: options?.validationSchema as Prisma.InputJsonValue | undefined
    };
    const createData = {
      key,
      value: value as Prisma.InputJsonValue,
      description: options?.description,
      category: options?.category || 'general',
      isPublic: options?.isPublic ?? false,
      isEditable: options?.isEditable ?? true,
      validationSchema: options?.validationSchema as Prisma.InputJsonValue | undefined
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return typedPrisma.systemConfig.upsert({
      where: { key },
      update: updateData,
      create: createData
    });
  }

  async deleteSystemConfig(key: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.systemConfig.delete({ where: { key } });
    await this.invalidateCache(`system:${key}`);
    return { success: true };
  }

  // ============================================
  // Tenant Config (Overrides)
  // ============================================

  async getTenantConfigs(tenantId?: string, category?: string): Promise<TenantConfig[]> {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;

    if (!targetTenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const typedPrisma = this.getTypedPrisma();
    const where: Prisma.TenantConfigWhereInput = { tenantId: targetTenantId };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (category) where.category = category;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const configs = await typedPrisma.tenantConfig.findMany({ where });

    return configs;
  }

  async getTenantConfig(tenantId: string, key: string) {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}tenant:${tenantId}:${key}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached;

    const typedPrisma = this.getTypedPrisma();

    // Check tenant config
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const tenantConfig = await typedPrisma.tenantConfig.findUnique({
      where: { tenantId_key: { tenantId, key } }
    });

    if (tenantConfig) {
      await this.redis.set(cacheKey, tenantConfig.value, this.CACHE_TTL);
      return tenantConfig.value;
    }

    // Fallback to system config
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const systemConfig = await typedPrisma.systemConfig.findUnique({ where: { key } });
    if (systemConfig) {
      await this.redis.set(cacheKey, systemConfig.value, this.CACHE_TTL);
      return systemConfig.value;
    }

    return null;
  }

  async setTenantConfig(tenantId: string, key: string, value: unknown, options?: TenantConfigSetOptions) {
    const context = this.tenantContext.getContext();

    if (!context?.isSystemAdmin && context?.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot set config for other tenants');
    }

    const typedPrisma = this.getTypedPrisma();

    // Get system config for validation/defaults (future use)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const _systemConfig = await typedPrisma.systemConfig.findUnique({ where: { key } });

    const updateData = {
      value: value as Prisma.InputJsonValue,
      isOverridden: true,
      description: options?.description,
      category: options?.category
    };
    const createData = {
      tenant: { connect: { id: tenantId } },
      key,
      value: value as Prisma.InputJsonValue,
      isOverridden: true,
      description: options?.description,
      category: options?.category || 'general'
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const config = await typedPrisma.tenantConfig.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: updateData,
      create: createData
    });

    await this.invalidateTenantCache(tenantId);
    return config;
  }

  async deleteTenantConfig(tenantId: string, key: string) {
    const context = this.tenantContext.getContext();

    if (!context?.isSystemAdmin && context?.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot delete config for other tenants');
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.tenantConfig.delete({
      where: { tenantId_key: { tenantId, key } }
    });

    await this.invalidateTenantCache(tenantId);
    return { success: true };
  }

  // ============================================
  // Config Validation
  // ============================================

  async validateConfig(key: string, value: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const systemConfig = await typedPrisma.systemConfig.findUnique({ where: { key } });

    if (!systemConfig?.validationSchema) {
      return { valid: true };
    }

    // Simple validation - in production use a proper JSON Schema validator
    const schema = systemConfig.validationSchema as ValidationSchema;
    const errors: string[] = [];

    if (schema.type && typeof value !== schema.type) {
      errors.push(`Expected type ${schema.type}, got ${typeof value}`);
    }

    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
    }

    if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
      errors.push(`Value must be at least ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && typeof value === 'number' && value > schema.maximum) {
      errors.push(`Value must be at most ${schema.maximum}`);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  // ============================================
  // Cache Management
  // ============================================

  private async invalidateCache(key: string) {
    await this.redis.del(key);
    // Also invalidate tenant cache if it's a system config
    if (key.startsWith('system:')) {
      await this.redis.delPattern(`${this.CACHE_PREFIX}tenant:*`);
    }
  }

  private async invalidateTenantCache(tenantId: string) {
    await this.redis.del(`${this.CACHE_PREFIX}tenant:${tenantId}`);
    await this.redis.delPattern(`${this.CACHE_PREFIX}tenant:${tenantId}:*`);
  }

  async refreshTenantCache(tenantId: string) {
    await this.invalidateTenantCache(tenantId);
    return this.getTenantConfigs(tenantId);
  }
}