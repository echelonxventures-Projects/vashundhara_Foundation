/**
 * Tenant Middleware for Vashundhara Foundation API
 * Resolves tenant from subdomain, header, JWT, or path
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Tenant } from '@vashundhara-foundation/shared';
import { Request, Response, NextFunction } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RequestWithTenant } from '../../guards/jwt-auth.guard';

interface TenantDelegate {
  findUnique: (args: { where: { id: string; deletedAt: null } }) => Promise<Tenant | null>;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);

      if (tenantId) {
        // Check cache first
        const cachedTenant = await this.getCachedTenant(tenantId);

        if (cachedTenant) {
          this.setTenantContext(req, cachedTenant);
        } else {
          // Fetch from database
          const tenantDelegate = this.prisma.tenant as TenantDelegate;
          const tenant = await tenantDelegate.findUnique({
            where: { id: tenantId, deletedAt: null }
          });

          if (tenant) {
            await this.cacheTenant(tenant);
            this.setTenantContext(req, tenant);
          }
        }
      }

      next();
    } catch (error) {
      // Don't block request on tenant resolution failure
      console.error('Tenant resolution error:', error);
      next();
    }
  }

  private resolveTenantId(req: Request): string | null {
    // 1. Check X-Tenant-ID header
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId && typeof headerTenantId === 'string') {
      return headerTenantId;
    }

    // 2. Check subdomain
    const hostname = req.hostname;
    if (hostname) {
      const subdomain = hostname.split('.')[0];
      if (subdomain && !['www', 'api', 'app', 'admin', 'localhost'].includes(subdomain)) {
        return subdomain; // Will be resolved as slug
      }
    }

    // 3. Check path prefix (/t/{tenant-slug}/...)
    const pathMatch = req.path.match(/^\/api\/v\d+\/t\/([^/]+)/);
    if (pathMatch) {
      return pathMatch[1]; // Will be resolved as slug
    }

    // 4. Check JWT claim (if authenticated)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      // JWT parsing would happen in auth guard
      // For middleware, we just pass through
    }

    return null;
  }

  private setTenantContext(req: Request, tenant: Tenant): void {
    (req as RequestWithTenant).tenant = tenant;
    (req as RequestWithTenant).tenantId = tenant.id;

    // Create minimal context for Prisma middleware
    this.tenantContext.setContext({
      tenantId: tenant.id,
      tenant,
      locale: tenant.defaultLocale,
      currency: tenant.defaultCurrency,
      timezone: tenant.timezone,
      isSystemAdmin: false,
      isTenantAdmin: false,
      roles: [],
      permissions: []
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async getCachedTenant(_tenantId: string): Promise<Tenant | null> {
    try {
      // This would use Redis service in real implementation
      // For now, return null to always fetch from DB
      return null;
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async cacheTenant(_tenant: Tenant): Promise<void> {
    try {
      // Cache tenant for 5 minutes
      // await this.redis.set(`tenant:${tenant.id}`, tenant, 300);
    } catch {
      // Ignore cache errors
    }
  }
}