"use strict";
/**
 * Tenant Context Management for Vashundhara Foundation Platform
 * Handles multi-tenant context resolution and propagation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENANT_RESOLUTION_PRIORITY = void 0;
exports.getTenantContext = getTenantContext;
exports.runWithTenantContext = runWithTenantContext;
exports.createTenantContext = createTenantContext;
exports.extractTenantId = extractTenantId;
exports.resolveTenant = resolveTenant;
exports.createTenantMiddleware = createTenantMiddleware;
exports.validateTenantAccess = validateTenantAccess;
exports.getTenantConfig = getTenantConfig;
exports.isFeatureEnabled = isFeatureEnabled;
exports.createBackgroundTenantContext = createBackgroundTenantContext;
/**
 * Tenant context storage using AsyncLocalStorage for request-scoped context
 */
const async_hooks_1 = require("async_hooks");
const tenantContextStorage = new async_hooks_1.AsyncLocalStorage();
/**
 * Get current tenant context
 */
function getTenantContext() {
    return tenantContextStorage.getStore();
}
/**
 * Run callback with tenant context
 */
function runWithTenantContext(context, callback) {
    return tenantContextStorage.run(context, callback);
}
/**
 * Create tenant context from tenant and user
 */
function createTenantContext(tenant, user, roles = [], permissions = []) {
    return {
        tenantId: tenant.id,
        tenant,
        userId: user?.id,
        user,
        roles,
        permissions,
        locale: user?.locale || tenant.defaultLocale,
        currency: user?.locale ? getCurrencyForLocale(user.locale) : tenant.defaultCurrency,
        timezone: user?.timezone || tenant.timezone,
        isSystemAdmin: roles.includes('super_admin') || roles.includes('system_admin'),
        isTenantAdmin: roles.includes('tenant_admin')
    };
}
/**
 * Get currency for locale (default mapping)
 */
function getCurrencyForLocale(locale) {
    const localeCurrencyMap = {
        en: 'USD',
        hi: 'INR',
        bn: 'INR',
        ta: 'INR',
        te: 'INR',
        mr: 'INR',
        gu: 'INR',
        kn: 'INR',
        ml: 'INR',
        or: 'INR',
        pa: 'INR',
        as: 'INR',
        ur: 'INR'
    };
    return localeCurrencyMap[locale] || 'INR';
}
/**
 * Extract tenant ID from various sources (subdomain, header, path, JWT)
 */
function extractTenantId(request) {
    // 1. Check X-Tenant-ID header
    if (request.headers['x-tenant-id']) {
        return request.headers['x-tenant-id'];
    }
    // 2. Check subdomain
    if (request.hostname) {
        const subdomain = request.hostname.split('.')[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'app') {
            return subdomain;
        }
    }
    // 3. Check path prefix (/t/{tenant-slug}/...)
    if (request.url) {
        const pathMatch = request.url.match(/^\/t\/([^/]+)/);
        if (pathMatch) {
            return pathMatch[1];
        }
    }
    // 4. Check JWT claim (would be parsed from auth header)
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
        // JWT parsing would happen here
        // For now, return null to indicate not found
    }
    return null;
}
/**
 * Tenant resolution priority order
 */
exports.TENANT_RESOLUTION_PRIORITY = [
    'subdomain',
    'header',
    'jwt',
    'path',
    'default'
];
async function resolveTenant(request, options) {
    // 1. Subdomain
    if (request.hostname) {
        const subdomain = request.hostname.split('.')[0];
        if (subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'app') {
            const tenant = await options.findTenantBySlug(subdomain);
            if (tenant) {
                return { tenantId: tenant.id, source: 'subdomain', tenant };
            }
        }
    }
    // 2. Header
    const headerTenantId = request.headers['x-tenant-id'];
    if (headerTenantId) {
        const tenant = await options.findTenantById(headerTenantId);
        if (tenant) {
            return { tenantId: tenant.id, source: 'header', tenant };
        }
    }
    // 3. JWT (would need JWT parsing)
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
        // JWT parsing logic here
        // const jwtTenantId = parseJwtTenantId(authHeader.slice(7));
        // if (jwtTenantId) {
        //   const tenant = await options.findTenantById(jwtTenantId);
        //   if (tenant) return { tenantId: tenant.id, source: 'jwt', tenant };
        // }
    }
    // 4. Path
    if (request.url) {
        const pathMatch = request.url.match(/^\/t\/([^/]+)/);
        if (pathMatch) {
            const tenant = await options.findTenantBySlug(pathMatch[1]);
            if (tenant) {
                return { tenantId: tenant.id, source: 'path', tenant };
            }
        }
    }
    // 5. Default
    const defaultTenant = await options.getDefaultTenant();
    if (defaultTenant) {
        return { tenantId: defaultTenant.id, source: 'default', tenant: defaultTenant };
    }
    return null;
}
/**
 * Middleware helper for Express/NestJS
 */
function createTenantMiddleware(options) {
    return async (req, res, next) => {
        try {
            const resolved = await resolveTenant({
                headers: req.headers,
                hostname: req.hostname,
                url: req.originalUrl || req.url
            }, options);
            if (resolved?.tenant) {
                req.tenant = resolved.tenant;
                req.tenantId = resolved.tenant.id;
                req.tenantResolutionSource = resolved.source;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
/**
 * Validate tenant access for user
 */
function validateTenantAccess(user, tenantId, requiredRoles) {
    // Check if user belongs to tenant
    if (user.tenantId !== tenantId) {
        // Check if user has system admin role
        // This would need roles from context
        return false;
    }
    // Check required roles if specified
    if (requiredRoles && requiredRoles.length > 0) {
        // Would check user roles from context
        // For now, return true
    }
    return true;
}
/**
 * Get tenant-specific configuration
 */
function getTenantConfig(context, key, defaultValue) {
    // First check tenant settings
    if (context.tenant.settings[key] !== undefined) {
        return context.tenant.settings[key];
    }
    // Then check tenant config (would be loaded separately)
    // For now, return default
    return defaultValue;
}
/**
 * Check if feature flag is enabled for tenant
 */
function isFeatureEnabled(context, flagKey, defaultValue = false) {
    // Would check feature flags from context
    // For now, return default
    return defaultValue;
}
/**
 * Create scoped tenant context for background jobs
 */
function createBackgroundTenantContext(tenantId, tenant) {
    return {
        tenantId,
        tenant,
        locale: tenant.defaultLocale,
        currency: tenant.defaultCurrency,
        timezone: tenant.timezone,
        isSystemAdmin: true, // Background jobs run with system permissions
        isTenantAdmin: true,
        roles: ['system_admin'],
        permissions: ['*']
    };
}
//# sourceMappingURL=tenant-context.js.map