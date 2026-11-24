import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { sha256 } from '@vashundhara-foundation/auth';
import { hasPermission, type Permission } from '@vashundhara-foundation/shared';
import type { Request } from 'express';
import { ENV, Env } from '../../env';
import { getCtx, runAsSystem } from '../context/context';
import { PrismaService } from '../prisma/prisma.module';
import { RedisService } from '../redis/redis.module';
import { PERMISSIONS, PLATFORM, PUBLIC, RATE, SELF } from './decorators';

export const ACCESS_COOKIE = 'vf_at';
export const REFRESH_COOKIE = 'vf_rt';

@Injectable()
export class RateGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly redis: RedisService, @Inject(ENV) private readonly env: Env) {}

  async canActivate(ec: ExecutionContext): Promise<boolean> {
    const req = ec.switchToHttp().getRequest<Request>();
    const ctx = getCtx();
    const rule = this.reflector.getAllAndOverride<{ limit: number; seconds: number; field?: string }>(RATE, [ec.getHandler(), ec.getClass()]);
    const { limit, seconds, field } = rule ?? { limit: 600, seconds: 60, field: undefined };
    const name = rule ? `${ec.getClass().name}.${ec.getHandler().name}` : 'all';
    const subjects = [`ip:${ctx?.ip ?? 'unknown'}`];
    const account = field && (req.body as Record<string, unknown> | undefined)?.[field];
    if (typeof account === 'string') subjects.push(`acct:${sha256(account.toLowerCase()).slice(0, 24)}`);
    for (const s of subjects) {
      if ((await this.redis.hit(`rl:${name}:${s}`, seconds)) > limit) {
        throw new HttpException({ code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.' }, 429);
      }
    }
    return true;
  }
}

/**
 * Deny by default: a route without @Public, @SelfService, @Can or @PlatformAdmin is refused.
 * Permissions come from the user's membership in the current NGO, never from the token.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector, private readonly jwt: JwtService,
    private readonly prisma: PrismaService, private readonly redis: RedisService, @Inject(ENV) private readonly env: Env
  ) {}

  async canActivate(ec: ExecutionContext): Promise<boolean> {
    const get = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ec.getHandler(), ec.getClass()]);
    const req = ec.switchToHttp().getRequest<Request>();
    const isPublic = get<boolean>(PUBLIC);
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string') await this.useApiKey(apiKey);
    else await this.useToken(req, Boolean(isPublic));
    if (isPublic) return true;

    const ctx = getCtx()!;
    if (!ctx.user) throw new UnauthorizedException('Please sign in');
    if (ctx.tenant && ctx.tenant.status === 'SUSPENDED' && !ctx.user.isSystemAdmin) throw new ForbiddenException('This organisation is suspended');
    if (get<boolean>(PLATFORM)) {
      if (!ctx.user.isSystemAdmin || !ctx.sessionId) throw new ForbiddenException('Platform administrators only');
      if (!ctx.user.mfaEnabled && this.env.NODE_ENV === 'production') throw new ForbiddenException('Turn on two-step verification first');
      return true;
    }
    const needed = get<Permission[]>(PERMISSIONS);
    if (needed?.length) {
      const missing = needed.filter((p) => !hasPermission(ctx.permissions, p));
      if (missing.length) throw new ForbiddenException(`You need permission: ${missing.join(', ')}`);
      return true;
    }
    if (get<boolean>(SELF)) {
      if (!ctx.sessionId) throw new ForbiddenException('Not available to API keys');
      return true;
    }
    throw new ForbiddenException('Route has no access rule');
  }

  private async useToken(req: Request, optional: boolean) {
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const token = bearer ?? cookie;
    if (!token) return;
    let payload: { sub: string; sid: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(token);
      if (payload.typ !== 'access') throw new Error('wrong type');
    } catch {
      if (optional) return;
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: 'Your session has expired' });
    }
    if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'vf') {
      throw new ForbiddenException('Missing request header');
    }
    const ok = await this.attach(payload.sub, payload.sid);
    if (!ok && !optional) throw new UnauthorizedException({ code: 'SESSION_ENDED', message: 'Please sign in again' });
  }

  /** Session and user are read on every request so logout and suspension apply at once. */
  private async attach(userId: string, sessionId: string): Promise<boolean> {
    const ctx = getCtx()!;
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE', deletedAt: null } },
      select: { user: { select: { id: true, email: true, firstName: true, lastName: true, emailVerified: true, isSystemAdmin: true, mfaEnabled: true } } }
    });
    if (!session) return false;
    const access = ctx.tenant ? await this.access(userId, ctx.tenant.id) : null;
    ctx.sessionId = sessionId;
    ctx.user = { ...session.user, membershipId: access?.membershipId ?? null, organizationId: access?.organizationId ?? null };
    ctx.roles = access?.roles ?? [];
    ctx.permissions = new Set(access?.permissions ?? []);
    if (session.user.isSystemAdmin) {
      const all = await this.redis.cached('perm:all', 60, () =>
        this.prisma.permission.findMany().then((ps) => ps.map((p) => `${p.resource}:${p.action.toLowerCase()}`)));
      ctx.roles = [...ctx.roles, 'system_admin'];
      ctx.permissions = new Set(all);
    }
    return true;
  }

  access(userId: string, tenantId: string) {
    return runAsSystem(async () => {
      const m = await this.prisma.membership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
      });
      if (!m || m.status !== 'ACTIVE') return null;
      const roles = m.roles.map((r) => r.role).filter((r) => !r.deletedAt);
      return {
        membershipId: m.id, organizationId: m.organizationId, roles: roles.map((r) => r.name),
        permissions: roles.flatMap((r) => r.permissions.map((p) => `${p.permission.resource}:${p.permission.action.toLowerCase()}`))
      };
    });
  }

  /** A key can never exceed what its owner holds today in the key's own NGO. */
  private async useApiKey(raw: string) {
    const ctx = getCtx()!;
    const key = await runAsSystem(() => this.prisma.apiKey.findUnique({ where: { keyHash: sha256(raw) }, include: { user: true, tenant: true } }));
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date()) || key.user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid API key');
    const access = await this.access(key.userId, key.tenantId);
    if (!access) throw new UnauthorizedException('Invalid API key');
    const t = key.tenant;
    ctx.tenant = { id: t.id, slug: t.slug, name: t.name, displayName: t.displayName, status: t.status, primaryDomain: t.primaryDomain, defaultLocale: t.defaultLocale, defaultCurrency: t.defaultCurrency };
    ctx.user = {
      id: key.userId, email: key.user.email, firstName: key.user.firstName, lastName: key.user.lastName, emailVerified: true,
      isSystemAdmin: false, mfaEnabled: key.user.mfaEnabled, membershipId: access.membershipId, organizationId: access.organizationId
    };
    ctx.permissions = new Set(key.permissions.filter((p) => hasPermission(access.permissions, p)));
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
      await runAsSystem(() => this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }));
    }
  }
}
