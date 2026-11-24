import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
  status: string;
  primaryDomain: string | null;
  defaultLocale: string;
  defaultCurrency: string;
}

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  isSystemAdmin: boolean;
  mfaEnabled: boolean;
  membershipId: string | null;
  organizationId: string | null;
}

export interface Ctx {
  requestId: string;
  ip?: string;
  userAgent?: string;
  tenant?: TenantInfo;
  user?: UserInfo;
  sessionId?: string;
  roles: string[];
  permissions: Set<string>;
  /** A page read made by our own web server while rendering. */
  internal?: boolean;
  /** Bypasses tenant scoping. Only set through runAsSystem(). */
  system?: boolean;
}

const als = new AsyncLocalStorage<Ctx>();

export const getCtx = (): Ctx | undefined => als.getStore();
export const runWithCtx = <T>(ctx: Ctx, fn: () => T): T => als.run(ctx, fn);

const blank = (): Ctx => ({ requestId: 'internal', roles: [], permissions: new Set() });

/**
 * Unscoped database access, for login, tenant lookup, workers and platform admin.
 * `fn` must be async so lazy Prisma promises are awaited inside the scope.
 */
export const runAsSystem = <T>(fn: () => Promise<T>): Promise<T> =>
  als.run({ ...(als.getStore() ?? blank()), system: true }, async () => await fn());

export const runAsTenant = <T>(tenant: TenantInfo, fn: () => Promise<T>): Promise<T> =>
  als.run({ ...(als.getStore() ?? blank()), tenant, system: false }, async () => await fn());

export function requireTenant(): TenantInfo {
  const t = getCtx()?.tenant;
  if (!t) throw new ForbiddenException('Unknown organisation');
  return t;
}

export function requireUser(): UserInfo {
  const u = getCtx()?.user;
  if (!u) throw new UnauthorizedException('Please sign in');
  return u;
}
