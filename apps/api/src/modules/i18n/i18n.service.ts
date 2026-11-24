/**
 * I18n Service for Vashundhara Foundation API
 * Manages translations with caching
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

// I18n type definitions
interface Translation {
  id: string;
  namespace: string;
  key: string;
  value: string;
  localeId: string;
  tenantId: string | null;
  context?: string | null;
  isReviewed: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface TranslationWhereInput {
  namespace?: string;
  localeId?: string;
  tenantId?: string | null;
  key?: string;
}

@Injectable()
export class I18nService {
  private readonly CACHE_TTL = 600; // 10 minutes
  private readonly CACHE_PREFIX = 'i18n:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  async getTranslations(
    namespace: string,
    locale: string,
    tenantId?: string
  ): Promise<Record<string, string>> {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;

    const cacheKey = `${this.CACHE_PREFIX}${namespace}:${locale}:${targetTenantId || 'global'}`;
    const cached = await this.redis.get<Record<string, string>>(cacheKey);
    if (cached) return cached;

    const where: TranslationWhereInput = { namespace, localeId: locale };
    if (targetTenantId) {
      where.tenantId = targetTenantId;
    } else {
      where.tenantId = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const translations = await this.prisma.translation.findMany({ where });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = translations.reduce((acc: Record<string, string>, t: Translation) => {
      acc[t.key] = t.value;
      return acc;
    }, {} as Record<string, string>);

    // Also get global translations as fallback
    if (targetTenantId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const globalTranslations = await this.prisma.translation.findMany({
        where: { namespace, localeId: locale, tenantId: null }
      });

      for (const t of globalTranslations) {
        if (!result[t.key]) {
          result[t.key] = t.value;
        }
      }
    }

    await this.redis.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async getNamespaces(locale: string, tenantId?: string): Promise<string[]> {
    const context = this.tenantContext.getContext();
    const targetTenantId = tenantId || context?.tenantId;

    const where: TranslationWhereInput = { localeId: locale };
    if (targetTenantId) {
      where.tenantId = targetTenantId;
    } else {
      where.tenantId = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const translations = await this.prisma.translation.findMany({
      where,
      select: { namespace: true },
      distinct: ['namespace']
    });

    return [...new Set(translations.map((t: Translation) => t.namespace))] as string[];
  }

  async createTranslation(data: {
    namespace: string;
    key: string;
    value: string;
    locale: string;
    tenantId?: string;
    context?: string;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = data.tenantId || context?.tenantId;

    if (!context?.isSystemAdmin && targetTenantId && context?.tenantId !== targetTenantId) {
      throw new ForbiddenException('Cannot create translations for other tenants');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const translation = await this.prisma.translation.upsert({
      where: {
        namespace_key_localeId_tenantId: {
          namespace: data.namespace,
          key: data.key,
          localeId: data.locale,
          tenantId: targetTenantId || null
        }
      },
      update: { value: data.value, context: data.context },
      create: {
        namespace: data.namespace,
        key: data.key,
        value: data.value,
        localeId: data.locale,
        tenantId: targetTenantId || null,
        context: data.context
      }
    });

    await this.invalidateCache(data.namespace, data.locale, targetTenantId);
    return translation;
  }

  async updateTranslation(
    id: string,
    data: { value: string; context?: string; isReviewed?: boolean }
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const translation = await this.prisma.translation.findUnique({ where: { id } });
    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    const context = this.tenantContext.getContext();
    if (!context?.isSystemAdmin && translation.tenantId && context?.tenantId !== translation.tenantId) {
      throw new ForbiddenException('Cannot update translations for other tenants');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const updated = await this.prisma.translation.update({
      where: { id },
      data
    });

    await this.invalidateCache(translation.namespace, translation.localeId, translation.tenantId || undefined);
    return updated;
  }

  async deleteTranslation(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const translation = await this.prisma.translation.findUnique({ where: { id } });
    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    const context = this.tenantContext.getContext();
    if (!context?.isSystemAdmin && translation.tenantId && context?.tenantId !== translation.tenantId) {
      throw new ForbiddenException('Cannot delete translations for other tenants');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.prisma.translation.delete({ where: { id } });
    await this.invalidateCache(translation.namespace, translation.localeId, translation.tenantId || undefined);
    return { success: true };
  }

  async bulkCreateTranslations(translations: Array<{
    namespace: string;
    key: string;
    value: string;
    locale: string;
    tenantId?: string;
    context?: string;
  }>) {
    const context = this.tenantContext.getContext();

    for (const t of translations) {
      const targetTenantId = t.tenantId || context?.tenantId;
      if (!context?.isSystemAdmin && targetTenantId && context?.tenantId !== targetTenantId) {
        throw new ForbiddenException('Cannot create translations for other tenants');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const results = await this.prisma.$transaction(
      translations.map(t => {
        const targetTenantId = t.tenantId || context?.tenantId;
        return this.prisma.translation.upsert({
          where: {
            namespace_key_localeId_tenantId: {
              namespace: t.namespace,
              key: t.key,
              localeId: t.locale,
              tenantId: targetTenantId || null
            }
          },
          update: { value: t.value, context: t.context },
          create: {
            namespace: t.namespace,
            key: t.key,
            value: t.value,
            localeId: t.locale,
            tenantId: targetTenantId || null,
            context: t.context
          }
        });
      })
    );

    // Invalidate all affected caches
    const namespaces = [...new Set(translations.map(t => t.namespace))];
    const locales = [...new Set(translations.map(t => t.locale))];
    const tenantIds = [...new Set(translations.map(t => t.tenantId || context?.tenantId))];

    for (const ns of namespaces) {
      for (const loc of locales) {
        for (const tid of tenantIds) {
          await this.invalidateCache(ns, loc, tid);
        }
      }
    }

    return { success: true, count: results.length };
  }

  private async invalidateCache(namespace: string, locale: string, tenantId?: string) {
    const key = `${this.CACHE_PREFIX}${namespace}:${locale}:${tenantId || 'global'}`;
    await this.redis.del(key);
  }
}