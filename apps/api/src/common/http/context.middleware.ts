import { randomUUID } from 'crypto';
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { safeEqual } from '@vashundhara-foundation/auth';
import type { NextFunction, Request, Response } from 'express';
import { ENV, Env } from '../../env';
import { Ctx, runAsSystem, runWithCtx, TenantInfo } from '../context/context';
import { PrismaService } from '../prisma/prisma.module';
import { RedisService } from '../redis/redis.module';

export const TENANT_SELECT = {
  id: true, slug: true, name: true, displayName: true, status: true, primaryDomain: true, defaultLocale: true, defaultCurrency: true
} as const;

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'docs', 'localhost']);

@Injectable()
export class TenantResolver {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, @Inject(ENV) private readonly env: Env) {}

  bySlug(slug: string): Promise<TenantInfo | null> {
    return this.load(`slug:${slug}`, { slug });
  }
  byId(id: string): Promise<TenantInfo | null> {
    return this.load(`id:${id}`, { id });
  }
  async invalidate(t: { id: string; slug: string; primaryDomain?: string | null }) {
    await this.redis.del(...[`id:${t.id}`, `slug:${t.slug}`, `domain:${t.primaryDomain}`].map((k) => `tenant:${k}`));
  }
  private load(key: string, where: { slug: string } | { id: string } | { primaryDomain: string }) {
    return this.redis.cached<TenantInfo | null>(`tenant:${key}`, 60, () =>
      runAsSystem(() => this.prisma.tenant.findFirst({ where: { ...where, deletedAt: null }, select: TENANT_SELECT }))
    );
  }

  /** Host decides the NGO. The slug header only selects among public sites; it never grants access. */
  async resolve(host: string, slugHeader?: string): Promise<TenantInfo | null> {
    const name = host.split(':')[0].toLowerCase();
    const root = this.env.ROOT_DOMAIN;
    if (name !== root && name.endsWith(`.${root}`)) {
      const sub = name.slice(0, -(root.length + 1));
      if (!RESERVED.has(sub)) return /^[a-z0-9-]{1,63}$/.test(sub) ? this.bySlug(sub) : null;
    } else if (name !== root && !RESERVED.has(name) && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) {
      const custom = await this.load(`domain:${name}`, { primaryDomain: name });
      if (custom) return custom;
    }
    if (slugHeader) return /^[a-z0-9-]{1,63}$/.test(slugHeader) ? this.bySlug(slugHeader) : null;
    return this.bySlug(this.env.DEFAULT_TENANT_SLUG);
  }

  url(t: Pick<TenantInfo, 'slug' | 'primaryDomain'>): string {
    const app = new URL(this.env.APP_URL);
    if (t.primaryDomain) return `${app.protocol}//${t.primaryDomain}`;
    if (t.slug === this.env.DEFAULT_TENANT_SLUG) return app.origin;
    return `${app.protocol}//${t.slug}.${this.env.ROOT_DOMAIN}${app.port ? `:${app.port}` : ''}`;
  }
}

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantResolver, @Inject(ENV) private readonly env: Env) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const requestId = /^[\w-]{8,64}$/.test(String(req.headers['x-request-id'])) ? String(req.headers['x-request-id']) : randomUUID();
      res.setHeader('x-request-id', requestId);
      // The web server forwards the visitor's host and IP. Only believe it when it proves who it is.
      const secret = this.env.INTERNAL_PROXY_SECRET;
      const trusted = secret ? safeEqual(String(req.headers['x-internal-proxy'] ?? ''), secret) : this.env.NODE_ENV !== 'production';
      const host = (trusted && (req.headers['x-vf-host'] as string)) || req.hostname || 'localhost';
      const ip = (trusted && (req.headers['x-vf-ip'] as string)) || req.ip;
      const hook = /\/payments\/\w+\/webhook\/([a-z0-9-]{1,63})$/.exec(req.originalUrl.split('?')[0])?.[1];
      const tenant = hook ? await this.tenants.bySlug(hook) : await this.tenants.resolve(host, req.headers['x-tenant-slug'] as string | undefined);
      const ctx: Ctx = {
        requestId, ip, userAgent: req.headers['user-agent']?.slice(0, 300),
        tenant: tenant ?? undefined, roles: [], permissions: new Set()
      };
      runWithCtx(ctx, () => next());
    } catch (e) {
      next(e);
    }
  }
}
