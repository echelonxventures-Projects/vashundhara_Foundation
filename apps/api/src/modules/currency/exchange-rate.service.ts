/**
 * Exchange Rate Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@vashundhara-foundation/database';
import { Decimal } from '@prisma/client/runtime/library';
import { CurrencyCode } from '@vashundhara-foundation/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Exchange Rate type definitions
export interface ExchangeRate {
  id: string;
  baseCurrencyId: string;
  targetCurrencyId: string;
  rate: Decimal;
  source: string;
  validFrom: Date;
  validUntil: Date | null;
  isManual: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  baseCurrency?: { id: string; code: string; symbol: string };
  targetCurrency?: { id: string; code: string; symbol: string };
}

interface ExchangeRateWhereInput {
  deletedAt?: null | { not: null };
  baseCurrencyId?: string;
  targetCurrencyId?: string;
  tenantId?: string | null;
  validFrom?: { lte?: Date; gte?: Date };
  validUntil?: { gte?: Date } | null;
  OR?: Array<{ validUntil?: null | { gte?: Date } }>;
}

interface ExchangeRateCreateInput {
  baseCurrencyId: string;
  targetCurrencyId: string;
  rate: Decimal;
  source?: string;
  validFrom?: Date;
  validUntil?: Date | null;
  isManual?: boolean;
  tenantId?: string | null;
}

interface ExchangeRateUpdateInput {
  rate?: Decimal;
  validUntil?: Date | null;
  source?: string;
  deletedAt?: Date;
}

interface Currency {
  id: string;
  code: string;
  isActive: boolean;
}

@Injectable()
export class ExchangeRateService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'exchangerate:';
  private readonly API_KEY: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService
  ) {
    this.API_KEY = this.configService.get<string>('EXCHANGE_RATE_API_KEY') || '';
  }

  private getTypedPrisma(): PrismaService & {
    exchangeRate: {
      findMany<T = ExchangeRate[]>(args: { where?: ExchangeRateWhereInput; skip?: number; take?: number; orderBy?: Prisma.ExchangeRateOrderByWithRelationInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
      count(args: { where?: ExchangeRateWhereInput }): Promise<number>;
      findUnique<T = ExchangeRate | null>(args: { where: Prisma.ExchangeRateWhereUniqueInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
      findFirst<T = ExchangeRate | null>(args: { where: ExchangeRateWhereInput; orderBy?: Prisma.ExchangeRateOrderByWithRelationInput }): Promise<T>;
      create<T = ExchangeRate>(args: { data: ExchangeRateCreateInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
      update<T = ExchangeRate>(args: { where: Prisma.ExchangeRateWhereUniqueInput; data: ExchangeRateUpdateInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
    };
    currency: {
      findFirst<T = Currency | null>(args: { where: Prisma.CurrencyWhereInput }): Promise<T>;
      findUnique<T = Currency | null>(args: { where: Prisma.CurrencyWhereUniqueInput }): Promise<T>;
      findMany<T = Currency[]>(args: { where: Prisma.CurrencyWhereInput }): Promise<T>;
    };
  } {
    return this.prisma as PrismaService & {
      exchangeRate: {
        findMany<T = ExchangeRate[]>(args: { where?: ExchangeRateWhereInput; skip?: number; take?: number; orderBy?: Prisma.ExchangeRateOrderByWithRelationInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
        count(args: { where?: ExchangeRateWhereInput }): Promise<number>;
        findUnique<T = ExchangeRate | null>(args: { where: Prisma.ExchangeRateWhereUniqueInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
        findFirst<T = ExchangeRate | null>(args: { where: ExchangeRateWhereInput; orderBy?: Prisma.ExchangeRateOrderByWithRelationInput }): Promise<T>;
        create<T = ExchangeRate>(args: { data: ExchangeRateCreateInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
        update<T = ExchangeRate>(args: { where: Prisma.ExchangeRateWhereUniqueInput; data: ExchangeRateUpdateInput; include?: Prisma.ExchangeRateInclude }): Promise<T>;
      };
      currency: {
        findFirst<T = Currency | null>(args: { where: Prisma.CurrencyWhereInput }): Promise<T>;
        findUnique<T = Currency | null>(args: { where: Prisma.CurrencyWhereUniqueInput }): Promise<T>;
        findMany<T = Currency[]>(args: { where: Prisma.CurrencyWhereInput }): Promise<T>;
      };
    };
  }

  async findAll(params: {
    baseCurrencyId?: string;
    targetCurrencyId?: string;
    tenantId?: string;
    page?: number;
    limit?: number;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = params.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const { baseCurrencyId, targetCurrencyId, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: ExchangeRateWhereInput = { deletedAt: null };

    if (baseCurrencyId) where.baseCurrencyId = baseCurrencyId;
    if (targetCurrencyId) where.targetCurrencyId = targetCurrencyId;

    if (!isSystemAdmin) {
      where.tenantId = targetTenantId;
    } else if (targetTenantId) {
      where.tenantId = targetTenantId;
    }

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.exchangeRate.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where,
        skip,
        take: limit,
        orderBy: { validFrom: 'desc' },
        include: {
          baseCurrency: true,
          targetCurrency: true
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.exchangeRate.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const rate = await typedPrisma.exchangeRate.findUnique({
      where: { id },
      include: { baseCurrency: true, targetCurrency: true }
    });

    if (!rate) {
      throw new NotFoundException('Exchange rate not found');
    }

    return rate;
  }

  async getRate(baseCurrencyCode: string, targetCurrencyCode: string, tenantId?: string, date: Date = new Date()): Promise<number> {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;

    if (baseCurrencyCode === targetCurrencyCode) return 1;

    const cacheKey = `${this.CACHE_PREFIX}${baseCurrencyCode}_${targetCurrencyCode}:${targetTenantId || 'global'}:${date.toISOString().split('T')[0]}`;
    const cached = await this.redis.get<number>(cacheKey);
    if (cached !== null) return cached;

    const typedPrisma = this.getTypedPrisma();

    // Find currencies
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [baseCurrency, targetCurrency] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.currency.findFirst({
        where: { code: baseCurrencyCode as CurrencyCode, isActive: true }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.currency.findFirst({
        where: { code: targetCurrencyCode as CurrencyCode, isActive: true }
      })
    ]);

    if (!baseCurrency || !targetCurrency) {
      throw new NotFoundException('One or both currencies not found');
    }

    // Find rate
    const where: ExchangeRateWhereInput = {
      baseCurrencyId: baseCurrency.id,
      targetCurrencyId: targetCurrency.id,
      validFrom: { lte: date },
      OR: [{ validUntil: null }, { validUntil: { gte: date } }]
    };

    if (targetTenantId) {
      where.tenantId = targetTenantId;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const rate = await typedPrisma.exchangeRate.findFirst({
      where,
      orderBy: { validFrom: 'desc' }
    });

    if (!rate) {
      // Try inverse rate
      const whereInverse: ExchangeRateWhereInput = {
        baseCurrencyId: targetCurrency.id,
        targetCurrencyId: baseCurrency.id,
        validFrom: { lte: date },
        OR: [{ validUntil: null }, { validUntil: { gte: date } }]
      };
      if (targetTenantId) whereInverse.tenantId = targetTenantId;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const inverseRate = await typedPrisma.exchangeRate.findFirst({
        where: whereInverse,
        orderBy: { validFrom: 'desc' }
      });

      if (inverseRate) {
        const inverseValue = 1 / Number(inverseRate.rate);
        await this.redis.set(cacheKey, inverseValue, this.CACHE_TTL);
        return inverseValue;
      }

      throw new NotFoundException(`Exchange rate not found for ${baseCurrencyCode} to ${targetCurrencyCode}`);
    }

    const value = Number(rate.rate);
    await this.redis.set(cacheKey, value, this.CACHE_TTL);
    return value;
  }

  async convert(amount: number, fromCurrency: string, toCurrency: string, tenantId?: string): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    const rate = await this.getRate(fromCurrency, toCurrency, tenantId);
    return amount * rate;
  }

  async create(data: ExchangeRateCreateInput) {
    const context = this.tenantContext.getContext();
    const targetTenantId = data.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    if (!isSystemAdmin && targetTenantId && context?.tenantId !== targetTenantId) {
      throw new ForbiddenException('Cannot create rates for other tenants');
    }

    const typedPrisma = this.getTypedPrisma();

    // Check if currencies exist
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [base, target] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.currency.findUnique({ where: { id: data.baseCurrencyId } }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.currency.findUnique({ where: { id: data.targetCurrencyId } })
    ]);

    if (!base || !target) {
      throw new NotFoundException('One or both currencies not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const rate = await typedPrisma.exchangeRate.create({
      data: {
        baseCurrencyId: data.baseCurrencyId,
        targetCurrencyId: data.targetCurrencyId,
        rate: new Decimal(data.rate),
        source: data.source || 'manual',
        validFrom: data.validFrom || new Date(),
        validUntil: data.validUntil,
        isManual: data.isManual || false,
        tenantId: targetTenantId
      },
      include: { baseCurrency: true, targetCurrency: true }
    });

    await this.invalidateCache();
    return rate;
  }

  async update(id: string, data: ExchangeRateUpdateInput) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const rate = await this.findById(id);

    if (rate.tenantId && !isSystemAdmin && context?.tenantId !== rate.tenantId) {
      throw new ForbiddenException('Cannot update rates for other tenants');
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const updated = await typedPrisma.exchangeRate.update({
      where: { id },
      data: {
        rate: data.rate ? new Decimal(data.rate) : undefined,
        validUntil: data.validUntil,
        source: data.source
      },
      include: { baseCurrency: true, targetCurrency: true }
    });

    await this.invalidateCache();
    return updated;
  }

  async delete(id: string) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const rate = await this.findById(id);

    if (rate.tenantId && !isSystemAdmin && context?.tenantId !== rate.tenantId) {
      throw new ForbiddenException('Cannot delete rates for other tenants');
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.exchangeRate.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.invalidateCache();
    return { success: true };
  }

  async fetchLatestRates(baseCurrencyCode: string = 'USD'): Promise<Record<string, number>> {
    if (!this.API_KEY) {
      throw new BadRequestException('Exchange rate API key not configured');
    }

    try {
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${this.API_KEY}/latest/${baseCurrencyCode}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }

      const data = await response.json() as { conversion_rates: Record<string, number> };
      return data.conversion_rates;
    } catch (error) {
      throw new BadRequestException(`Failed to fetch rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async syncRates(baseCurrencyCode: string = 'USD', tenantId?: string): Promise<{ created: number; updated: number }> {
    const rates = await this.fetchLatestRates(baseCurrencyCode);

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const baseCurrency = await typedPrisma.currency.findUnique({
      where: { code: baseCurrencyCode as CurrencyCode }
    });

    if (!baseCurrency) {
      throw new NotFoundException(`Base currency ${baseCurrencyCode} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const targetCurrencies = await typedPrisma.currency.findMany({
      where: { code: { in: Object.keys(rates) as CurrencyCode[] }, isActive: true }
    });

    let created = 0;
    let updated = 0;

    for (const targetCurrency of targetCurrencies) {
      if (targetCurrency.id === baseCurrency.id) continue;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const rateValue = rates[targetCurrency.code];
      if (!rateValue) continue;

      const whereExisting: ExchangeRateWhereInput = {
        baseCurrencyId: baseCurrency.id,
        targetCurrencyId: targetCurrency.id,
        tenantId: tenantId || null,
        validFrom: { lte: new Date() },
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }]
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const existing = await typedPrisma.exchangeRate.findFirst({
        where: whereExisting
      });

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await typedPrisma.exchangeRate.update({
          where: { id: existing.id },
          data: { rate: new Decimal(rateValue), source: 'exchangerate-api.com' }
        });
        updated++;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await typedPrisma.exchangeRate.create({
          data: {
            baseCurrencyId: baseCurrency.id,
            targetCurrencyId: targetCurrency.id,
            rate: new Decimal(rateValue),
            source: 'exchangerate-api.com',
            validFrom: new Date(),
            tenantId: tenantId || null
          }
        });
        created++;
      }
    }

    await this.invalidateCache();
    return { created, updated };
  }

  private async invalidateCache() {
    await this.redis.delPattern(`${this.CACHE_PREFIX}*`);
  }
}