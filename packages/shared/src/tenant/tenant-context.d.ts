/**
 * Tenant Context Management for Vashundhara Foundation Platform
 * Handles multi-tenant context resolution and propagation
 */
import type { TenantContext, Tenant, User } from '../types';
/**
 * Get current tenant context
 */
export declare function getTenantContext(): TenantContext | undefined;
/**
 * Run callback with tenant context
 */
export declare function runWithTenantContext<T>(context: TenantContext, callback: () => T): T;
/**
 * Create tenant context from tenant and user
 */
export declare function createTenantContext(tenant: Tenant, user?: User, roles?: string[], permissions?: string[]): TenantContext;
/**
 * Extract tenant ID from various sources (subdomain, header, path, JWT)
 */
export declare function extractTenantId(request: {
    headers: Record<string, string | undefined>;
    hostname?: string;
    url?: string;
}): string | null;
/**
 * Tenant resolution priority order
 */
export declare const TENANT_RESOLUTION_PRIORITY: readonly ["subdomain", "header", "jwt", "path", "default"];
export type TenantResolutionSource = typeof TENANT_RESOLUTION_PRIORITY[number];
/**
 * Resolve tenant with source tracking
 */
export interface ResolvedTenant {
    tenantId: string;
    source: TenantResolutionSource;
    tenant?: Tenant;
}
export declare function resolveTenant(request: {
    headers: Record<string, string | undefined>;
    hostname?: string;
    url?: string;
}, options: {
    findTenantById: (id: string) => Promise<Tenant | null>;
    findTenantBySlug: (slug: string) => Promise<Tenant | null>;
    findTenantByDomain: (domain: string) => Promise<Tenant | null>;
    getDefaultTenant: () => Promise<Tenant | null>;
}): Promise<ResolvedTenant | null>;
/**
 * Middleware helper for Express/NestJS
 */
export declare function createTenantMiddleware(options: {
    findTenantById: (id: string) => Promise<Tenant | null>;
    findTenantBySlug: (slug: string) => Promise<Tenant | null>;
    findTenantByDomain: (domain: string) => Promise<Tenant | null>;
    getDefaultTenant: () => Promise<Tenant | null>;
}): (req: any, res: any, next: any) => Promise<void>;
/**
 * Validate tenant access for user
 */
export declare function validateTenantAccess(user: User, tenantId: string, requiredRoles?: string[]): boolean;
/**
 * Get tenant-specific configuration
 */
export declare function getTenantConfig<T>(context: TenantContext, key: string, defaultValue: T): T;
/**
 * Check if feature flag is enabled for tenant
 */
export declare function isFeatureEnabled(context: TenantContext, flagKey: string, defaultValue?: boolean): boolean;
/**
 * Create scoped tenant context for background jobs
 */
export declare function createBackgroundTenantContext(tenantId: string, tenant: Tenant): TenantContext;
//# sourceMappingURL=tenant-context.d.ts.map