/**
 * @vashundhara-foundation/feature-flags - Feature Flag System
 * Supports boolean, string, number, and JSON flags with targeting rules
 */
import type { FeatureFlag, TenantContext } from '@vashundhara-foundation/shared';
/**
 * Feature Flag Service
 */
export declare class FeatureFlagService {
    private flags;
    private cache;
    private defaultTtlMs;
    /**
     * Register a feature flag
     */
    registerFlag(flag: FeatureFlag): void;
    /**
     * Register multiple flags
     */
    registerFlags(flags: FeatureFlag[]): void;
    /**
     * Get flag value for context
     */
    getValue<T = unknown>(key: string, context: TenantContext, defaultValue: T): Promise<T>;
    /**
     * Get boolean flag value
     */
    isEnabled(key: string, context: TenantContext, defaultValue?: boolean): Promise<boolean>;
    /**
     * Get string flag value
     */
    getString(key: string, context: TenantContext, defaultValue?: string): Promise<string>;
    /**
     * Get number flag value
     */
    getNumber(key: string, context: TenantContext, defaultValue?: number): Promise<number>;
    /**
     * Get JSON flag value
     */
    getJSON<T = unknown>(key: string, context: TenantContext, defaultValue: T): Promise<T>;
    /**
     * Get all flags for tenant
     */
    getFlagsForTenant(tenantId: string): FeatureFlag[];
    /**
     * Update flag
     */
    updateFlag(key: string, tenantId: string | undefined, updates: Partial<FeatureFlag>): boolean;
    /**
     * Delete flag
     */
    deleteFlag(key: string, tenantId: string | undefined): boolean;
    /**
     * Check if flag exists
     */
    hasFlag(key: string, tenantId: string | undefined): boolean;
    /**
     * Invalidate cache for flag
     */
    private invalidateCache;
    /**
     * Find flag with tenant inheritance
     */
    private findFlag;
    /**
     * Evaluate targeting rules
     */
    private evaluateTargeting;
    /**
     * Check if user is in rollout percentage
     */
    private isInRollout;
    /**
     * Get flag key with tenant prefix
     */
    private getFlagKey;
    /**
     * Get cache key
     */
    private getCacheKey;
}
/**
 * Create feature flag decorator for classes
 */
export declare function FeatureFlag(key: string, defaultValue: unknown): (target: object, propertyKey: string) => void;
/**
 * React hook for feature flags (client-side)
 */
export declare function createFeatureFlagHook(service: FeatureFlagService): <T>(key: string, defaultValue: T) => T;
/**
 * Default feature flag service instance
 */
export declare const featureFlagService: FeatureFlagService;
/**
 * Built-in feature flags
 */
export declare const BUILTIN_FLAGS: FeatureFlag[];
//# sourceMappingURL=index.d.ts.map