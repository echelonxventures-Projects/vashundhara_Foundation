import { BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, Prisma, User } from '@prisma/client';
import { FieldCipher, generateTotpSecret, hashPassword, passwordProblems, randomToken, sha256, totpUri, verifyPassword, verifyTotp } from '@vashundhara-foundation/auth';
import { ROLE_TEMPLATES, SELF_SERVICE_ROLES } from '@vashundhara-foundation/shared';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { ENV, Env } from '../../env';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser, runAsSystem, runAsTenant, TenantInfo } from '../../common/context/context';
import { TenantResolver } from '../../common/http/context.middleware';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../common/http/guards';
import { PrismaService } from '../../common/prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.module';

const ACCESS_SEC = 15 * 60;
const DAY = 86_400_000;
const REFRESH_GRACE_MS = 20_000;

@Injectable()
export class AuthService {
  private readonly cipher: FieldCipher;
  constructor(
    private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly audit: AuditService,
    private readonly notify: NotificationsService, private readonly tenants: TenantResolver, @Inject(ENV) private readonly env: Env
  ) {
    this.cipher = new FieldCipher(env.ENCRYPTION_KEY);
  }

  // ---------- registration ----------

  checkPassword(password: string) {
    const problems = passwordProblems(password);
    if (problems.length) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: problems.join('. '), details: problems.map((message) => ({ path: 'password', message })) });
  }

  /** Same answer whether or not the email exists. Only self-service roles can be chosen. */
  async register(b: { email: string; password: string; firstName: string; lastName: string; role: string; locale?: string; acceptTerms: true }) {
    this.checkPassword(b.password);
    const tenant = requireTenant();
    if (!(SELF_SERVICE_ROLES as readonly string[]).includes(b.role)) throw new ForbiddenException('That role needs an invitation');
    const passwordHash = await hashPassword(b.password);
    const existing = await this.prisma.user.findUnique({ where: { email: b.email } });
    if (existing) {
      await this.notify.send({ template: 'auth.exists', to: existing.email, userId: existing.id, vars: { name: existing.firstName, link: this.link(tenant, 'login') } });
      return { ok: true };
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: b.email, passwordHash, firstName: b.firstName, lastName: b.lastName, locale: (b.locale ?? tenant.defaultLocale) as never } });
      await this.join(tx, u.id, tenant.id, [b.role]);
      await tx.consentRecord.create({ data: { tenantId: tenant.id, userId: u.id, email: u.email, purpose: 'terms', version: '1', granted: true, ipAddress: getCtx()?.ip } });
      return u;
    });
    await this.sendVerification(user, tenant);
    await this.audit.log('CREATE', 'user', user.id, undefined, { email: user.email, role: b.role }, { userId: user.id });
    return { ok: true };
  }

  /** New NGO. Stays PENDING_SETUP and cannot raise money until the platform approves it. */
  async registerNgo(b: { ngoName: string; slug: string; email: string; password: string; firstName: string; lastName: string; acceptTerms: true }) {
    if (!this.env.SIGNUP_NGO_ENABLED) throw new ForbiddenException('NGO sign-up is closed');
    this.checkPassword(b.password);
    const passwordHash = await hashPassword(b.password);
    return runAsSystem(async () => {
      if (await this.prisma.tenant.findUnique({ where: { slug: b.slug } })) throw new ConflictException({ code: 'SLUG_TAKEN', message: 'That web address is taken' });
      if (await this.prisma.user.findUnique({ where: { email: b.email } })) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Sign in first, then create your NGO from your account' });
      const { user, tenant } = await this.prisma.$transaction(async (tx) => {
        const t = await tx.tenant.create({ data: { slug: b.slug, name: b.ngoName, displayName: b.ngoName, status: 'PENDING_SETUP' } });
        const u = await tx.user.create({ data: { email: b.email, passwordHash, firstName: b.firstName, lastName: b.lastName } });
        await this.join(tx, u.id, t.id, ['tenant_admin']);
        return { user: u, tenant: t };
      });
      const info: TenantInfo = { id: tenant.id, slug: tenant.slug, name: tenant.name, displayName: tenant.displayName, status: tenant.status, primaryDomain: null, defaultLocale: 'en', defaultCurrency: 'INR' };
      await this.audit.log('CREATE', 'tenant', tenant.id, undefined, { slug: tenant.slug }, { tenantId: tenant.id, userId: user.id });
      await runAsTenant(info, () => this.sendVerification(user, info));
      return { ok: true, url: this.tenants.url(info) };
    });
  }

  async join(tx: Prisma.TransactionClient, userId: string, tenantId: string, roleNames: string[], organizationId?: string | null) {
    const roles = await tx.role.findMany({ where: { name: { in: roleNames }, tenantId: null, scope: 'TENANT', deletedAt: null } });
    if (roles.length !== new Set(roleNames).size) throw new Error(`Roles are not seeded: ${roleNames.join(', ')}`);
    let m = await tx.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } });
    m ??= await tx.membership.create({ data: { userId, tenantId, organizationId } });
    await tx.membershipRole.createMany({ data: roles.map((r) => ({ membershipId: m.id, roleId: r.id })), skipDuplicates: true });
    return m;
  }

  // ---------- one-time tokens ----------

  private async issue(userId: string, type: AuthTokenType, minutes: number) {
    const token = randomToken();
    await this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + minutes * 60_000) } });
    return token;
  }
  /** Atomic, so two parallel requests cannot both use one token. */
  private async consume(token: string, type: AuthTokenType) {
    const where = { tokenHash: sha256(token), type, usedAt: null, expiresAt: { gt: new Date() } };
    const row = await this.prisma.authToken.findFirst({ where });
    const { count } = await this.prisma.authToken.updateMany({ where, data: { usedAt: new Date() } });
    if (!row || count !== 1) throw new BadRequestException({ code: 'BAD_TOKEN', message: 'This link is invalid or has expired' });
    return row.userId;
  }
  private link(t: TenantInfo, path: string, token?: string) {
    return `${this.tenants.url(t)}/${t.defaultLocale}/${path}${token ? `#token=${token}` : ''}`;
  }

  private async sendVerification(user: Pick<User, 'id' | 'email' | 'firstName'>, tenant: TenantInfo) {
    const token = await this.issue(user.id, 'EMAIL_VERIFY', 24 * 60);
    await this.notify.send({ template: 'auth.verify', to: user.email, userId: user.id, vars: { name: user.firstName, link: this.link(tenant, 'verify-email', token) } });
  }
  async resendVerification(email: string) {
    const u = await this.prisma.user.findUnique({ where: { email } });
    if (u && !u.emailVerified && u.status === 'PENDING_VERIFICATION') await this.sendVerification(u, requireTenant());
    return { ok: true };
  }
  async verifyEmail(token: string) {
    const userId = await this.consume(token, 'EMAIL_VERIFY');
    await this.prisma.user.updateMany({ where: { id: userId, status: 'PENDING_VERIFICATION' }, data: { status: 'ACTIVE' } });
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
    return { ok: true };
  }

  async requestReset(email: string) {
    const u = await this.prisma.user.findUnique({ where: { email } });
    if (u && !u.deletedAt && u.status !== 'SUSPENDED' && u.status !== 'DELETED') {
      const token = await this.issue(u.id, 'PASSWORD_RESET', 60);
      await this.notify.send({ template: 'auth.reset', to: u.email, userId: u.id, vars: { name: u.firstName, link: this.link(requireTenant(), 'reset-password', token) } });
    }
    return { ok: true };
  }
  async reset(token: string, password: string) {
    this.checkPassword(password);
    const userId = await this.consume(token, 'PASSWORD_RESET');
    const passwordHash = await hashPassword(password);
    // Receiving the link proves control of the mailbox.
    await this.prisma.user.updateMany({ where: { id: userId, status: 'PENDING_VERIFICATION' }, data: { status: 'ACTIVE' } });
    const u = await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerified: true, failedLogins: 0, lockedUntil: null } });
    await this.revokeAll(userId);
    await this.passwordChanged(u);
    return { ok: true };
  }
  async changePassword(current: string, next: string) {
    const { id } = requireUser();
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (!(await verifyPassword(current, u.passwordHash))) throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Your current password is not correct' });
    this.checkPassword(next);
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(next) } });
    await this.revokeAll(id, getCtx()?.sessionId);
    await this.passwordChanged(u);
    return { ok: true };
  }
  private async passwordChanged(u: User) {
    await this.audit.log('PASSWORD_CHANGE', 'user', u.id, undefined, undefined, { userId: u.id });
    await this.notify.send({ template: 'auth.password_changed', to: u.email, userId: u.id, vars: { name: u.firstName, link: this.link(requireTenant(), 'forgot-password') } });
  }

  // ---------- sign in ----------

  async login(b: { email: string; password: string; rememberMe?: boolean }, res: Response) {
    const u = await this.prisma.user.findUnique({ where: { email: b.email } });
    const locked = Boolean(u?.lockedUntil && u.lockedUntil > new Date());
    const ok = await verifyPassword(b.password, locked ? null : u?.passwordHash);
    if (!u || !ok || u.deletedAt) {
      if (u && !locked) {
        const r = await this.prisma.user.update({ where: { id: u.id }, data: { failedLogins: { increment: 1 } }, select: { failedLogins: true } });
        if (r.failedLogins >= 10) await this.prisma.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60_000) } });
        await this.audit.log('FAILED_LOGIN', 'user', u.id, undefined, undefined, { userId: u.id });
      }
      throw new UnauthorizedException({ code: 'BAD_CREDENTIALS', message: 'Email or password is not correct' });
    }
    if (u.status === 'PENDING_VERIFICATION') throw new ForbiddenException({ code: 'EMAIL_UNVERIFIED', message: 'Please confirm your email first' });
    if (u.status !== 'ACTIVE') throw new ForbiddenException({ code: 'INACTIVE', message: 'This account is not active' });
    if (u.mfaEnabled) {
      return { mfaRequired: true, challenge: await this.jwt.signAsync({ sub: u.id, typ: 'mfa', rm: Boolean(b.rememberMe) }, { expiresIn: 300 }) };
    }
    return this.startSession(u.id, Boolean(b.rememberMe), res);
  }

  async loginMfa(challenge: string, code: string, res: Response) {
    let p: { sub: string; typ: string; rm: boolean };
    try {
      p = await this.jwt.verifyAsync(challenge);
      if (p.typ !== 'mfa') throw new Error();
    } catch {
      throw new UnauthorizedException({ code: 'MFA_EXPIRED', message: 'Please sign in again' });
    }
    const u = await this.prisma.user.findUnique({ where: { id: p.sub } });
    if (!u || u.status !== 'ACTIVE' || (u.lockedUntil && u.lockedUntil > new Date())) throw new UnauthorizedException('Please sign in again');
    if (!(await this.checkCode(u, code))) {
      const r = await this.prisma.user.update({ where: { id: u.id }, data: { failedLogins: { increment: 1 } }, select: { failedLogins: true } });
      if (r.failedLogins >= 10) await this.prisma.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60_000) } });
      await this.audit.log('FAILED_LOGIN', 'user', u.id, undefined, { step: 'mfa' }, { userId: u.id });
      throw new UnauthorizedException({ code: 'BAD_CODE', message: 'That code is not correct' });
    }
    return this.startSession(u.id, p.rm, res);
  }

  async startSession(userId: string, rememberMe: boolean, res: Response) {
    const c = getCtx();
    const refresh = randomToken(48);
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 * DAY : DAY));
    const s = await this.prisma.session.create({ data: { userId, refreshHash: sha256(refresh), tenantId: c?.tenant?.id, rememberMe, ipAddress: c?.ip, userAgent: c?.userAgent, expiresAt } });
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
    await this.audit.log('LOGIN', 'user', userId, undefined, undefined, { userId });
    return this.issueTokens(userId, s.id, refresh, expiresAt, rememberMe, res);
  }

  private async issueTokens(userId: string, sid: string, refresh: string, expiresAt: Date, remember: boolean, res: Response) {
    const accessToken = await this.jwt.signAsync({ sub: userId, sid, typ: 'access' }, { expiresIn: ACCESS_SEC });
    const base = { httpOnly: true, secure: this.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
    res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_SEC * 1000 });
    res.cookie(REFRESH_COOKIE, refresh, { ...base, ...(remember ? { expires: expiresAt } : {}), path: '/api/auth' });
    return { accessToken, expiresIn: ACCESS_SEC, tokenType: 'Bearer' };
  }

  /** Rotates on use. Presenting an old token after the grace period ends the whole session. */
  async refresh(raw: string | undefined, res: Response) {
    const fail = () => {
      this.clear(res);
      return new UnauthorizedException({ code: 'SESSION_ENDED', message: 'Please sign in again' });
    };
    if (!raw) throw fail();
    const hash = sha256(raw);
    const s = await this.prisma.session.findFirst({ where: { OR: [{ refreshHash: hash }, { previousHash: hash }] }, include: { user: true } });
    if (!s || s.revokedAt || s.expiresAt < new Date() || s.user.status !== 'ACTIVE') throw fail();
    if (s.refreshHash !== hash) {
      if (s.rotatedAt && Date.now() - s.rotatedAt.getTime() < REFRESH_GRACE_MS) {
        // Two tabs refreshed together: give an access token, keep the newer refresh token.
        const accessToken = await this.jwt.signAsync({ sub: s.userId, sid: s.id, typ: 'access' }, { expiresIn: ACCESS_SEC });
        res.cookie(ACCESS_COOKIE, accessToken, { httpOnly: true, secure: this.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: ACCESS_SEC * 1000 });
        return { accessToken, expiresIn: ACCESS_SEC, tokenType: 'Bearer' };
      }
      await this.prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
      await this.audit.log('FAILED_LOGIN', 'session', s.id, undefined, { reason: 'refresh reuse' }, { userId: s.userId });
      throw fail();
    }
    const next = randomToken(48);
    const { count } = await this.prisma.session.updateMany({ where: { id: s.id, refreshHash: hash }, data: { refreshHash: sha256(next), previousHash: hash, rotatedAt: new Date() } });
    if (count !== 1) throw fail();
    return this.issueTokens(s.userId, s.id, next, s.expiresAt, s.rememberMe, res);
  }

  clear(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }
  async logout(refresh: string | undefined, res: Response) {
    const sid = getCtx()?.sessionId;
    const where = sid ? { id: sid } : refresh ? { refreshHash: sha256(refresh) } : null;
    if (where) await this.prisma.session.updateMany({ where, data: { revokedAt: new Date() } });
    if (sid) await this.audit.log('LOGOUT', 'user', requireUser().id);
    this.clear(res);
    return { ok: true };
  }
  async revokeAll(userId: string, except?: string) {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null, ...(except ? { id: { not: except } } : {}) }, data: { revokedAt: new Date() } });
  }

  // ---------- two-step verification ----------

  private async checkCode(u: User, code: string): Promise<boolean> {
    const clean = code.replace(/[\s-]/g, '');
    if (/^\d{6}$/.test(clean) && u.mfaSecretEnc) {
      const step = verifyTotp(this.cipher.decrypt(u.mfaSecretEnc, `mfa:${u.id}`), clean, u.mfaLastStep);
      if (step === null) return false;
      const { count } = await this.prisma.user.updateMany({ where: { id: u.id, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] }, data: { mfaLastStep: step } });
      return count === 1;
    }
    const hash = sha256(clean.toLowerCase());
    if (!u.mfaBackupHashes.includes(hash)) return false;
    const { count } = await this.prisma.user.updateMany({ where: { id: u.id, mfaBackupHashes: { has: hash } }, data: { mfaBackupHashes: u.mfaBackupHashes.filter((h) => h !== hash) } });
    return count === 1;
  }
  async mfaSetup(password: string) {
    const { id, email } = requireUser();
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (u.mfaEnabled) throw new ConflictException('Two-step verification is already on');
    if (!(await verifyPassword(password, u.passwordHash))) throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Your password is not correct' });
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id }, data: { mfaSecretEnc: this.cipher.encrypt(secret, `mfa:${id}`), mfaLastStep: null } });
    return { secret, uri: totpUri(secret, email, 'NGO Platform') };
  }
  async mfaEnable(code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: requireUser().id } });
    if (u.mfaEnabled || !u.mfaSecretEnc) throw new BadRequestException('Start setup first');
    if (!/^\d{6}$/.test(code) || !(await this.checkCode(u, code))) throw new BadRequestException({ code: 'BAD_CODE', message: 'That code is not correct' });
    const backupCodes = Array.from({ length: 10 }, () => randomToken(8).replace(/[^a-zA-Z0-9]/g, 'x').toLowerCase().slice(0, 10));
    await this.prisma.user.update({ where: { id: u.id }, data: { mfaEnabled: true, mfaBackupHashes: backupCodes.map(sha256) } });
    await this.revokeAll(u.id, getCtx()?.sessionId);
    await this.audit.log('UPDATE', 'mfa', u.id, undefined, { enabled: true });
    return { backupCodes };
  }
  async mfaDisable(password: string, code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: requireUser().id } });
    if (!u.mfaEnabled) return { ok: true };
    if (!(await verifyPassword(password, u.passwordHash)) || !(await this.checkCode(u, code))) throw new BadRequestException({ code: 'BAD_CODE', message: 'Password or code is not correct' });
    await this.prisma.user.update({ where: { id: u.id }, data: { mfaEnabled: false, mfaSecretEnc: null, mfaBackupHashes: [], mfaLastStep: null } });
    await this.audit.log('UPDATE', 'mfa', u.id, undefined, { enabled: false });
    return { ok: true };
  }

  // ---------- invitations ----------

  async invitation(token: string) {
    const i = await runAsSystem(() => this.prisma.invitation.findFirst({ where: { tokenHash: sha256(token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, include: { tenant: { select: { id: true, name: true, displayName: true } } } }));
    if (!i || i.tenantId !== requireTenant().id) throw new BadRequestException({ code: 'BAD_TOKEN', message: 'This invitation is invalid or has expired' });
    return i;
  }
  async previewInvitation(token: string) {
    const i = await this.invitation(token);
    const u = await this.prisma.user.findUnique({ where: { email: i.email }, select: { id: true } });
    return { email: i.email, organisation: i.tenant.displayName ?? i.tenant.name, hasAccount: Boolean(u) };
  }
  async acceptInvitation(b: { token: string; password?: string; firstName?: string; lastName?: string }) {
    const i = await this.invitation(b.token);
    const existing = await this.prisma.user.findUnique({ where: { email: i.email } });
    if (existing) {
      if (getCtx()?.user?.id !== existing.id) throw new UnauthorizedException({ code: 'SIGN_IN_FIRST', message: 'Sign in with the invited email, then open the link again' });
    } else {
      if (!b.password || !b.firstName || !b.lastName) throw new BadRequestException('Name and password are required');
      this.checkPassword(b.password);
    }
    const passwordHash = existing ? null : await hashPassword(b.password!);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.invitation.updateMany({ where: { id: i.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
      if (count !== 1) throw new BadRequestException('This invitation was already used');
      const u = existing ?? (await tx.user.create({ data: { email: i.email, passwordHash, firstName: b.firstName!, lastName: b.lastName!, emailVerified: true, status: 'ACTIVE' } }));
      let m = await tx.membership.findUnique({ where: { userId_tenantId: { userId: u.id, tenantId: i.tenantId } } });
      m = m
        ? await tx.membership.update({ where: { id: m.id }, data: { status: 'ACTIVE', ...(i.organizationId ? { organizationId: i.organizationId } : {}) } })
        : await tx.membership.create({ data: { userId: u.id, tenantId: i.tenantId, organizationId: i.organizationId } });
      await tx.membershipRole.createMany({ data: i.roleIds.map((roleId) => ({ membershipId: m.id, roleId, assignedBy: i.invitedById })), skipDuplicates: true });
    });
    await this.audit.log('APPROVE', 'invitation', i.id, undefined, { email: i.email });
    return { ok: true };
  }

  // ---------- Google ----------

  async googleStart(res: Response) {
    if (!this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) throw new BadRequestException('Google sign-in is not configured');
    const nonce = randomToken(16);
    const verifier = randomToken(48);
    const state = await this.jwt.signAsync({ typ: 'google', nonce: sha256(nonce), tid: requireTenant().id }, { expiresIn: 600 });
    res.cookie('vf_go', `${nonce}.${verifier}`, { httpOnly: true, secure: this.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth', maxAge: 600_000 });
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID, redirect_uri: this.googleRedirect(), response_type: 'code', scope: 'openid email profile', state,
      code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url')
    }).toString();
    return u.toString();
  }
  private googleRedirect() { return `${this.tenants.url(requireTenant())}/api/auth/google/callback`; }

  async googleFinish(code: string, state: string, cookie: string | undefined, res: Response): Promise<string> {
    const tenant = requireTenant();
    const [nonce, verifier] = (cookie ?? '').split('.');
    const st = await this.jwt.verifyAsync<{ typ: string; nonce: string; tid: string }>(state).catch(() => null);
    if (!st || st.typ !== 'google' || st.tid !== tenant.id || !nonce || st.nonce !== sha256(nonce)) throw new BadRequestException('Google sign-in expired. Please try again.');
    res.clearCookie('vf_go', { path: '/api/auth' });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ code, client_id: this.env.GOOGLE_CLIENT_ID!, client_secret: this.env.GOOGLE_CLIENT_SECRET!, redirect_uri: this.googleRedirect(), grant_type: 'authorization_code', code_verifier: verifier })
    });
    if (!r.ok) throw new HttpException('Google did not accept the sign-in', 502);
    // The ID token came straight from Google over TLS, so its claims can be read directly.
    const { id_token } = (await r.json()) as { id_token: string };
    const claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString()) as { sub: string; aud: string; iss: string; exp: number; email: string; email_verified: boolean; given_name?: string; family_name?: string };
    if (claims.aud !== this.env.GOOGLE_CLIENT_ID || !/^(https:\/\/)?accounts\.google\.com$/.test(claims.iss) || claims.exp * 1000 < Date.now() || !claims.email_verified) throw new UnauthorizedException('Google account could not be verified');
    let u = await this.prisma.user.findUnique({ where: { googleSub: claims.sub } });
    if (!u) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: claims.email } });
      if (byEmail) {
        // Never attach Google to an unverified account someone else may have pre-registered.
        u = byEmail.emailVerified
          ? await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: claims.sub } })
          : await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: claims.sub, emailVerified: true, status: 'ACTIVE', passwordHash: null } });
      } else {
        u = await this.prisma.$transaction(async (tx) => {
          const n = await tx.user.create({ data: { email: claims.email, googleSub: claims.sub, firstName: claims.given_name ?? 'Friend', lastName: claims.family_name ?? '', emailVerified: true, status: 'ACTIVE' } });
          await this.join(tx, n.id, tenant.id, ['donor']);
          return n;
        });
      }
    }
    if (u.status !== 'ACTIVE' || u.deletedAt) throw new ForbiddenException('This account is not active');
    const home = `${this.tenants.url(tenant)}/${tenant.defaultLocale}`;
    if (u.mfaEnabled) {
      const challenge = await this.jwt.signAsync({ sub: u.id, typ: 'mfa', rm: false }, { expiresIn: 300 });
      return `${home}/login#challenge=${challenge}`;
    }
    await this.startSession(u.id, false, res);
    return `${home}/account`;
  }

  // ---------- me ----------

  async me() {
    const c = getCtx()!;
    if (!c.user) return { user: null, roles: [], permissions: [], tenant: c.tenant ?? null, memberships: [] };
    const userId = c.user.id;
    const memberships = await runAsSystem(() => this.prisma.membership.findMany({ where: { userId, status: 'ACTIVE' }, select: { tenant: { select: { slug: true, name: true, displayName: true, primaryDomain: true } } } }));
    return {
      user: c.user, roles: c.roles, permissions: [...c.permissions], tenant: c.tenant ?? null,
      memberships: memberships.map((m) => ({ slug: m.tenant.slug, name: m.tenant.displayName ?? m.tenant.name, url: this.tenants.url(m.tenant) }))
    };
  }
  /** Adds a self-service role for the signed-in user in this NGO, for example a donor who also volunteers. */
  async addRole(role: string) {
    if (!(SELF_SERVICE_ROLES as readonly string[]).includes(role) || !ROLE_TEMPLATES.some((r) => r.name === role)) throw new ForbiddenException('That role needs an invitation');
    const { id, membershipId } = requireUser();
    const tenantId = requireTenant().id;
    const m = await this.prisma.membership.findFirst({ where: { userId: id } });
    if (m && m.status !== 'ACTIVE' && !membershipId) throw new ForbiddenException('Your access here is suspended');
    await this.prisma.$transaction((tx) => this.join(tx, id, tenantId, [role]));
    return { ok: true };
  }
}
