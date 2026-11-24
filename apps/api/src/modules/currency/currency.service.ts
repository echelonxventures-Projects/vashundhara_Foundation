/**
 * Currency Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';
import { CurrencyCode } from '@vashundhara-foundation/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Currency type definitions
export interface Currency {
  id: string;
  code: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  decimals: number;
  name: string;
  namePlural: string;
  isBase: boolean;
  isActive: boolean;
  formatting: Prisma.InputJsonValue;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CurrencyCreateInput {
  code: string;
  symbol: string;
  symbolPosition?: 'prefix' | 'suffix';
  decimals?: number;
  name: string;
  namePlural: string;
  isBase?: boolean;
  formatting?: Prisma.InputJsonValue;
  tenantId?: string;
}

interface CurrencyUpdateInput {
  symbol?: string;
  symbolPosition?: 'prefix' | 'suffix';
  decimals?: number;
  name?: string;
  namePlural?: string;
  isActive?: boolean;
  formatting?: Prisma.InputJsonValue;
}

interface CurrencyWhereInput {
  isActive?: boolean;
  code?: string;
  isBase?: boolean;
  tenantId?: string | null;
  OR?: Array<{ tenantId?: string | null; isBase?: boolean }>;
}

@Injectable()
export class CurrencyService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'currency:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    currency: {
      findMany<T = Currency[]>(args: { where?: CurrencyWhereInput; orderBy?: Prisma.CurrencyOrderByWithRelationInput[] }): Promise<T>;
      findUnique<T = Currency | null>(args: { where: Prisma.CurrencyWhereUniqueInput }): Promise<T>;
      findFirst<T = Currency | null>(args: { where: CurrencyWhereInput }): Promise<T>;
      create<T = Currency>(args: { data: Prisma.CurrencyCreateInput }): Promise<T>;
      update<T = Currency>(args: { where: Prisma.CurrencyWhereUniqueInput; data: Prisma.CurrencyUpdateInput }): Promise<T>;
    };
  } {
    return this.prisma as PrismaService & {
      currency: {
        findMany<T = Currency[]>(args: { where?: CurrencyWhereInput; orderBy?: Prisma.CurrencyOrderByWithRelationInput[] }): Promise<T>;
        findUnique<T = Currency | null>(args: { where: Prisma.CurrencyWhereUniqueInput }): Promise<T>;
        findFirst<T = Currency | null>(args: { where: CurrencyWhereInput }): Promise<T>;
        create<T = Currency>(args: { data: Prisma.CurrencyCreateInput }): Promise<T>;
        update<T = Currency>(args: { where: Prisma.CurrencyWhereUniqueInput; data: Prisma.CurrencyUpdateInput }): Promise<T>;
      };
    };
  }

  findAll(tenantId?: string) {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const where: CurrencyWhereInput = { isActive: true };

    if (!isSystemAdmin) {
      where.OR = [
        { tenantId: targetTenantId },
        { tenantId: null, isBase: true }
      ];
    } else if (targetTenantId) {
      where.OR = [
        { tenantId: targetTenantId },
        { tenantId: null }
      ];
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return typedPrisma.currency.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where,
      orderBy: [{ isBase: 'desc' }, { code: 'asc' }]
    });
  }

  async findById(id: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const currency = await typedPrisma.currency.findUnique({
      where: { id }
    });

    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    return currency;
  }

  async findByCode(code: string, tenantId?: string) {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;

    const where: CurrencyWhereInput = { code: code.toUpperCase(), isActive: true };

    if (targetTenantId) {
      where.OR = [
        { tenantId: targetTenantId },
        { tenantId: null }
      ];
    } else {
      where.tenantId = null;
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const currency = await typedPrisma.currency.findFirst({ where });

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    return currency;
  }

  async create(data: CurrencyCreateInput) {
    const context = this.tenantContext.getContext();
    const targetTenantId = data.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    if (!isSystemAdmin && data.isBase) {
      throw new ForbiddenException('Only system admins can create base currency');
    }

    const typedPrisma = this.getTypedPrisma();

    // Check uniqueness
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const existing = await typedPrisma.currency.findFirst({
      where: {
        code: data.code.toUpperCase(),
        tenantId: data.isBase ? null : targetTenantId
      }
    });

    if (existing) {
      throw new ConflictException('Currency with this code already exists');
    }

    if (data.isBase) {
      // Ensure only one base currency
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const existingBase = await typedPrisma.currency.findFirst({
        where: { isBase: true }
      });
      if (existingBase) {
        throw new ConflictException('Base currency already exists');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const currency = await typedPrisma.currency.create({
      data: {
        code: data.code.toUpperCase() as CurrencyCode,
        symbol: data.symbol,
        symbolPosition: data.symbolPosition || 'prefix',
        decimals: data.decimals || 2,
        name: data.name,
        namePlural: data.namePlural,
        isBase: data.isBase || false,
        formatting: data.formatting as Prisma.InputJsonValue || {},
        tenant: data.isBase ? undefined : { connect: { id: targetTenantId } }
      }
    });

    await this.invalidateCache();
    return currency;
  }

  async update(id: string, data: CurrencyUpdateInput) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const currency = await this.findById(id);

    if (currency.isBase && !isSystemAdmin) {
      throw new ForbiddenException('Cannot modify base currency');
    }

    if (currency.tenantId && !isSystemAdmin && context?.tenantId !== currency.tenantId) {
      throw new ForbiddenException('Cannot modify currency of other tenants');
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const updated = await typedPrisma.currency.update({
      where: { id },
      data
    });

    await this.invalidateCache();
    return updated;
  }

  async delete(id: string) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const currency = await this.findById(id);

    if (currency.isBase) {
      throw new BadRequestException('Cannot delete base currency');
    }

    if (currency.tenantId && !isSystemAdmin && context?.tenantId !== currency.tenantId) {
      throw new ForbiddenException('Cannot delete currency of other tenants');
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.currency.update({
      where: { id },
      data: { isActive: false }
    });

    await this.invalidateCache();
    return { success: true };
  }

  async getBaseCurrency(): Promise<Currency> {
    const cacheKey = `${this.CACHE_PREFIX}base`;
    const cached = await this.redis.get<Currency>(cacheKey);
    if (cached) return cached;

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const currency = await typedPrisma.currency.findFirst({
      where: { isBase: true, isActive: true }
    });

    if (!currency) {
      throw new NotFoundException('Base currency not configured');
    }

    await this.redis.set(cacheKey, currency, this.CACHE_TTL);
    return currency;
  }

  private async invalidateCache() {
    await this.redis.delPattern(`${this.CACHE_PREFIX}*`);
  }
}