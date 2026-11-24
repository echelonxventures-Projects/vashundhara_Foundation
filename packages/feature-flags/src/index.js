"use strict";
/**
 * @vashundhara-foundation/feature-flags - Feature Flag System
 * Supports boolean, string, number, and JSON flags with targeting rules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_FLAGS = exports.featureFlagService = exports.FeatureFlagService = void 0;
exports.FeatureFlag = FeatureFlag;
exports.createFeatureFlagHook = createFeatureFlagHook;
// In-memory store (replace with Redis in production)
const flagStore = new Map();
/**
 * Feature Flag Service
 */
class FeatureFlagService {
    constructor() {
        this.flags = new Map();
        this.cache = new Map();
        this.defaultTtlMs = 60000; // 1 minute
    }
    /**
     * Register a feature flag
     */
    registerFlag(flag) {
        this.flags.set(this.getFlagKey(flag.key, flag.tenantId), flag);
        this.invalidateCache(flag.key, flag.tenantId);
    }
    /**
     * Register multiple flags
     */
    registerFlags(flags) {
        flags.forEach(flag => this.registerFlag(flag));
    }
    /**
     * Get flag value for context
     */
    async getValue(key, context, defaultValue) {
        const flag = this.findFlag(key, context.tenantId);
        if (!flag) {
            return defaultValue;
        }
        if (!flag.isEnabled) {
            return flag.defaultValue;
        }
        // Check targeting rules
        if (flag.targetingRules && !this.evaluateTargeting(flag.targetingRules, context)) {
            return flag.defaultValue;
        }
        // Check rollout percentage
        if (flag.rolloutPercentage < 100 && !this.isInRollout(context.userId || context.tenantId, flag.rolloutPercentage)) {
            return flag.defaultValue;
        }
        return flag.defaultValue;
    }
    /**
     * Get boolean flag value
     */
    async isEnabled(key, context, defaultValue = false) {
        const value = await this.getValue(key, context, defaultValue);
        return Boolean(value);
    }
    /**
     * Get string flag value
     */
    async getString(key, context, defaultValue = '') {
        const value = await this.getValue(key, context, defaultValue);
        return String(value);
    }
    /**
     * Get number flag value
     */
    async getNumber(key, context, defaultValue = 0) {
        const value = await this.getValue(key, context, defaultValue);
        return Number(value);
    }
    /**
     * Get JSON flag value
     */
    async getJSON(key, context, defaultValue) {
        const value = await this.getValue(key, context, defaultValue);
        return value;
    }
    /**
     * Get all flags for tenant
     */
    getFlagsForTenant(tenantId) {
        const prefix = `${tenantId}:`;
        return Array.from(this.flags.values()).filter(f => f.tenantId === tenantId || (!f.tenantId && !this.flags.has(`${tenantId}:${f.key}`)));
    }
    /**
     * Update flag
     */
    updateFlag(key, tenantId, updates) {
        const flagKey = this.getFlagKey(key, tenantId);
        const flag = this.flags.get(flagKey);
        if (!flag)
            return false;
        const updated = { ...flag, ...updates, updatedAt: new Date() };
        this.flags.set(flagKey, updated);
        this.invalidateCache(key, tenantId);
        return true;
    }
    /**
     * Delete flag
     */
    deleteFlag(key, tenantId) {
        const flagKey = this.getFlagKey(key, tenantId);
        const deleted = this.flags.delete(flagKey);
        this.invalidateCache(key, tenantId);
        return deleted;
    }
    /**
     * Check if flag exists
     */
    hasFlag(key, tenantId) {
        return this.flags.has(this.getFlagKey(key, tenantId));
    }
    /**
     * Invalidate cache for flag
     */
    invalidateCache(key, tenantId) {
        const cacheKey = this.getCacheKey(key, tenantId);
        this.cache.delete(cacheKey);
    }
    /**
     * Find flag with tenant inheritance
     */
    findFlag(key, tenantId) {
        // First check tenant-specific flag
        const tenantFlag = this.flags.get(this.getFlagKey(key, tenantId));
        if (tenantFlag)
            return tenantFlag;
        // Then check global flag
        return this.flags.get(this.getFlagKey(key, undefined));
    }
    /**
     * Evaluate targeting rules
     */
    evaluateTargeting(rules, context) {
        // Simple rule evaluation - extend as needed
        // Rules can include: userIds, roles, countries, custom attributes
        if (rules.userIds && Array.isArray(rules.userIds)) {
            if (context.userId && !rules.userIds.includes(context.userId)) {
                return false;
            }
        }
        if (rules.roles && Array.isArray(rules.roles)) {
            const hasRole = context.roles.some(r => rules.roles.includes(r));
            if (!hasRole)
                return false;
        }
        if (rules.countries && Array.isArray(rules.countries)) {
            // Would need country from context
            // if (context.country && !rules.countries.includes(context.country)) return false;
        }
        if (rules.customAttributes && typeof rules.customAttributes === 'object') {
            // Custom attribute matching
            for (const [attr, value] of Object.entries(rules.customAttributes)) {
                // Would check context.metadata[attr] === value
            }
        }
        return true;
    }
    /**
     * Check if user is in rollout percentage
     */
    isInRollout(identifier, percentage) {
        // Consistent hashing based on identifier
        let hash = 0;
        for (let i = 0; i < identifier.length; i++) {
            hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
            hash |= 0;
        }
        const bucket = Math.abs(hash) % 100;
        return bucket < percentage;
    }
    /**
     * Get flag key with tenant prefix
     */
    getFlagKey(key, tenantId) {
        return tenantId ? `${tenantId}:${key}` : `global:${key}`;
    }
    /**
     * Get cache key
     */
    getCacheKey(key, tenantId) {
        return tenantId ? `${tenantId}:${key}` : `global:${key}`;
    }
}
exports.FeatureFlagService = FeatureFlagService;
/**
 * Create feature flag decorator for classes
 */
function FeatureFlag(key, defaultValue) {
    return function (target, propertyKey) {
        const service = new FeatureFlagService();
        Object.defineProperty(target, propertyKey, {
            get: async function () {
                // This would need context injection in real implementation
                return defaultValue;
            },
            configurable: true
        });
    };
}
/**
 * React hook for feature flags (client-side)
 */
function createFeatureFlagHook(service) {
    return function useFeatureFlag(key, defaultValue) {
        // This would be implemented with React context in the frontend
        // For now, return default value
        return defaultValue;
    };
}
/**
 * Default feature flag service instance
 */
exports.featureFlagService = new FeatureFlagService();
/**
 * Built-in feature flags
 */
exports.BUILTIN_FLAGS = [
    {
        id: 'new-donation-flow',
        key: 'new-donation-flow',
        name: 'New Donation Flow',
        description: 'Enable the redesigned donation flow',
        type: 'BOOLEAN',
        defaultValue: false,
        isEnabled: false,
        rolloutPercentage: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'beta-reports',
        key: 'beta-reports',
        name: 'Beta Reports',
        description: 'Enable beta reporting features',
        type: 'BOOLEAN',
        defaultValue: false,
        isEnabled: false,
        rolloutPercentage: 0,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'max-donation-amount',
        key: 'max-donation-amount',
        name: 'Maximum Donation Amount',
        description: 'Maximum allowed donation amount',
        type: 'NUMBER',
        defaultValue: 1000000,
        isEnabled: true,
        rolloutPercentage: 100,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'supported-payment-methods',
        key: 'supported-payment-methods',
        name: 'Supported Payment Methods',
        description: 'List of enabled payment methods',
        type: 'JSON',
        defaultValue: ['card', 'upi', 'netbanking', 'wallet'],
        isEnabled: true,
        rolloutPercentage: 100,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'maintenance-mode',
        key: 'maintenance-mode',
        name: 'Maintenance Mode',
        description: 'Enable maintenance mode for the platform',
        type: 'BOOLEAN',
        defaultValue: false,
        isEnabled: false,
        rolloutPercentage: 100,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    }
];
// Register built-in flags
exports.featureFlagService.registerFlags(exports.BUILTIN_FLAGS);
//# sourceMappingURL=index.js.map