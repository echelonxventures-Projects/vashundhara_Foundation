/**
 * Tenant Context Service for Vashundhara Foundation API
 * Manages request-scoped tenant context using AsyncLocalStorage
 */

import { AsyncLocalStorage } from 'async_hooks';

import { Injectable } from '@nestjs/common';
import type { TenantContext, Tenant, User } from '@vashundhara-foundation/shared';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  /**
   * Get current tenant context
   */
  getContext(): TenantContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Set tenant context for current execution context
   */
  setContext(context: TenantContext): void {
    this.storage.enterWith(context);
  }

  /**
   * Run callback with tenant context
   */
  runWithContext<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  /**
   * Get tenant ID from context
   */
  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  /**
   * Get tenant from context
   */
  getTenant(): TenantContext['tenant'] | undefined {
    return this.storage.getStore()?.tenant;
  }

  /**
   * Get user ID from context
   */
  getUserId(): string | undefined {
    return this.storage.getStore()?.userId;
  }

  /**
   * Get locale from context
   */
  getLocale(): string | undefined {
    return this.storage.getStore()?.locale;
  }

  /**
   * Get currency from context
   */
  getCurrency(): string | undefined {
    return this.storage.getStore()?.currency;
  }

  /**
   * Get timezone from context
   */
  getTimezone(): string | undefined {
    return this.storage.getStore()?.timezone;
  }

  /**
   * Check if current context is system admin
   */
  isSystemAdmin(): boolean {
    return this.storage.getStore()?.isSystemAdmin ?? false;
  }

  /**
   * Check if current context is tenant admin
   */
  isTenantAdmin(): boolean {
    return this.storage.getStore()?.isTenantAdmin ?? false;
  }

  /**
   * Get roles from context
   */
  getRoles(): string[] {
    return this.storage.getStore()?.roles ?? [];
  }

  /**
   * Get permissions from context
   */
  getPermissions(): string[] {
    return this.storage.getStore()?.permissions ?? [];
  }

  /**
   * Create full tenant context
   */
  createContext(params: {
    tenantId: string;
    tenant: Tenant;
    userId?: string;
    user?: User;
    roles?: string[];
    permissions?: string[];
    locale?: string;
    currency?: string;
    timezone?: string;
    isSystemAdmin?: boolean;
    isTenantAdmin?: boolean;
  }): TenantContext {
    return {
      tenantId: params.tenantId,
      tenant: params.tenant,
      userId: params.userId,
      user: params.user,
      roles: params.roles ?? [],
      permissions: params.permissions ?? [],
      locale: (params.locale ?? params.tenant?.defaultLocale ?? 'en') as import('@vashundhara-foundation/shared').LocaleCode,
      currency: (params.currency ?? params.tenant?.defaultCurrency ?? 'INR') as import('@vashundhara-foundation/shared').CurrencyCode,
      timezone: params.timezone ?? params.tenant?.timezone ?? 'Asia/Kolkata',
      isSystemAdmin: params.isSystemAdmin ?? false,
      isTenantAdmin: params.isTenantAdmin ?? false
    };
  }
}