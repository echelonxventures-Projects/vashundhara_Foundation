/**
 * Tenant Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException
} from '@nestjs/common';
import type { Prisma, CurrencyCode } from '@vashundhara-foundation/database';
import { generateSlug } from '@vashundhara-foundation/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Tenant type definitions
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryDomain: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_SETUP' | 'ARCHIVED';
  defaultCurrency: CurrencyCode;
  defaultLocale: string;
  supportedCurrencies: string[];
  supportedLocales: string[];
  timezone: string;
  settings: Prisma.InputJsonValue;
  metadata: Prisma.InputJsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface TenantWhereInput {
  deletedAt?: null | { not: null };
  slug?: string;
  primaryDomain?: string;
  status?: string;
  OR?: Array<Record<string, unknown>>;
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    tenant: {
      findMany<T = Tenant[]>(args: { where?: TenantWhereInput; skip?: number; take?: number; orderBy?: Prisma.TenantOrderByWithRelationInput; include?: Prisma.TenantInclude }): Promise<T>;
      count(args: { where?: TenantWhereInput }): Promise<number>;
      findUnique<T = Tenant | null>(args: { where: Prisma.TenantWhereUniqueInput; include?: Prisma.TenantInclude }): Promise<T>;
      create<T = Tenant>(args: { data: Prisma.TenantCreateInput }): Promise<T>;
      update<T = Tenant>(args: { where: Prisma.TenantWhereUniqueInput; data: Prisma.TenantUpdateInput }): Promise<T>;
    };
    role: {
      create(args: { data: Prisma.RoleCreateInput }): Promise<{ id: string }>;
    };
  } {
    return this.prisma as PrismaService & {
      tenant: {
        findMany<T = Tenant[]>(args: { where?: TenantWhereInput; skip?: number; take?: number; orderBy?: Prisma.TenantOrderByWithRelationInput; include?: Prisma.TenantInclude }): Promise<T>;
        count(args: { where?: TenantWhereInput }): Promise<number>;
        findUnique<T = Tenant | null>(args: { where: Prisma.TenantWhereUniqueInput; include?: Prisma.TenantInclude }): Promise<T>;
        create<T = Tenant>(args: { data: Prisma.TenantCreateInput }): Promise<T>;
        update<T = Tenant>(args: { where: Prisma.TenantWhereUniqueInput; data: Prisma.TenantUpdateInput }): Promise<T>;
      };
      role: {
        create(args: { data: Prisma.RoleCreateInput }): Promise<{ id: string }>;
      };
    };
  }

  // ============================================
  // CRUD Operations
  // ============================================

  async create(data: {
    name: string;
    displayName?: string;
    description?: string;
    slug?: string;
    primaryDomain?: string;
    defaultCurrency?: string;
    defaultLocale?: string;
    timezone?: string;
    settings?: Record<string, unknown>;
  }) {
    const context = this.tenantContext.getContext();

    // Only system admins can create tenants
    if (!context?.isSystemAdmin) {
      throw new ForbiddenException('Only system administrators can create tenants');
    }

    const slug = data.slug || generateSlug(data.name);

    // Check slug uniqueness
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException('Tenant slug already exists');
    }

    // Check domain uniqueness
    if (data.primaryDomain) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const existingDomain = await this.prisma.tenant.findUnique({
        where: { primaryDomain: data.primaryDomain }
      });
      if (existingDomain) {
        throw new ConflictException('Primary domain already in use');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        displayName: data.displayName || data.name,
        description: data.description,
        slug,
        primaryDomain: data.primaryDomain,
        defaultCurrency: (data.defaultCurrency || 'INR') as CurrencyCode,
        defaultLocale: data.defaultLocale || 'en',
        timezone: data.timezone || 'Asia/Kolkata',
        settings: data.settings as Prisma.InputJsonValue || {},
        status: 'PENDING_SETUP'
      }
    });

    // Create default roles for tenant
    await this.createDefaultRoles(tenant.id);

    // Invalidate cache
    await this.invalidateCache();

    return tenant;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const context = this.tenantContext.getContext();

    // Non-system admins can only see their own tenant
    if (!context?.isSystemAdmin) {
      if (!context?.tenantId) {
        throw new ForbiddenException('Tenant context required');
      }
      const tenant = await this.findById(context.tenantId);
      return { data: [tenant], total: 1, page: 1, limit: 1, totalPages: 1 };
    }

    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: TenantWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { primaryDomain: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status;
    }

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.tenant.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { users: true }
          }
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.tenant.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(id: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const tenant = await typedPrisma.tenant.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { users: true, roles: true, featureFlags: true }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const tenant = await typedPrisma.tenant.findUnique({
      where: { slug, deletedAt: null }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, data: {
    name?: string;
    displayName?: string;
    description?: string;
    primaryDomain?: string;
    defaultCurrency?: string;
    defaultLocale?: string;
    timezone?: string;
    settings?: Record<string, unknown>;
    status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_SETUP' | 'ARCHIVED';
  }) {
    const context = this.tenantContext.getContext();

    // Check permissions
    if (!context?.isSystemAdmin && context?.tenantId !== id) {
      throw new ForbiddenException('Cannot update other tenants');
    }

    // Check if tenant exists
    await this.findById(id);

    // Check domain uniqueness
    if (data.primaryDomain) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const existingDomain = await this.prisma.tenant.findFirst({
        where: { primaryDomain: data.primaryDomain, NOT: { id } }
      });
      if (existingDomain) {
        throw new ConflictException('Primary domain already in use');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...data,
        defaultCurrency: data.defaultCurrency as CurrencyCode | undefined,
        defaultLocale: data.defaultLocale,
        settings: data.settings as Prisma.InputJsonValue | undefined
      }
    });

    // Invalidate cache
    await this.invalidateCache(id);

    return tenant;
  }

  async delete(id: string) {
    const context = this.tenantContext.getContext();

    if (!context?.isSystemAdmin) {
      throw new ForbiddenException('Only system administrators can delete tenants');
    }

    await this.findById(id);

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.tenant.update({
      where: { id },
      data: { status: 'ARCHIVED', deletedAt: new Date() }
    });

    await this.invalidateCache(id);

    return { success: true };
  }

  // ============================================
  // Tenant Settings
  // ============================================

  async getSettings(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await this.findById(tenantId);
    return (tenant.settings as Record<string, unknown>) || {};
  }

  async updateSettings(tenantId: string, settings: Record<string, unknown>) {
    const context = this.tenantContext.getContext();

    if (!context?.isSystemAdmin && context?.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot update other tenant settings');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: settings as Prisma.InputJsonValue }
    });

    await this.invalidateCache(tenantId);

    return tenant.settings;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async createDefaultRoles(tenantId: string) {
    const defaultRoles = [
      { name: 'tenant_admin', displayName: 'Tenant Admin', description: 'Full tenant access', priority: 80 },
      { name: 'manager', displayName: 'Manager', description: 'Management access', priority: 60 },
      { name: 'member', displayName: 'Member', description: 'Standard access', priority: 40 },
      { name: 'viewer', displayName: 'Viewer', description: 'Read-only access', priority: 20 }
    ];

    for (const role of defaultRoles) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.role.create({
        data: {
          ...role,
          tenant: { connect: { id: tenantId } },
          scope: 'TENANT',
          isSystem: false
        }
      });
    }
  }

  private async invalidateCache(tenantId?: string) {
    if (tenantId) {
      await this.redis.del(`tenant:${tenantId}`);
    } else {
      await this.redis.delPattern('tenant:*');
    }
  }

  // ============================================
  // Stats
  // ============================================

  async getStats(tenantId: string) {
    const context = this.tenantContext.getContext();

    if (!context?.isSystemAdmin && context?.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot access other tenant stats');
    }

    const [
      userCount,
      donationCount,
      campaignCount,
      revenue
    ] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
      // Add other counts as models are created
      Promise.resolve(0),
      Promise.resolve(0),
      Promise.resolve(0)
    ]);

    return {
      users: userCount,
      donations: donationCount,
      campaigns: campaignCount,
      revenue
    };
  }
}