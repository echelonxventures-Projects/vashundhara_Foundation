/**
 * Auth Service for Vashundhara Foundation API
 */

import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
// eslint-disable-next-line import/no-unresolved
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Type definitions for user with relations
interface UserWithRelations {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  tenantId: string;
  status: string;
  emailVerified: boolean;
  locale: string;
  timezone: string;
  lastLoginAt: Date | null;
  tenant: {
    id: string;
    slug: string;
    name: string;
    displayName: string;
    status: string;
    defaultLocale: string;
    defaultCurrency: string;
    timezone: string;
  };
  userRoles: Array<{
    role: {
      id: string;
      name: string;
      permissions?: Array<{
        permission: {
          resource: string;
          action: string;
        };
      }>;
    };
  }>;
}

// Typed Prisma interfaces for Auth module
interface UserFindUniqueArgs {
  where: { email?: string; id?: string };
  include?: {
    tenant?: boolean;
    userRoles?: { include: { role: { include: { permissions: { include: { permission: boolean } } } } } };
  };
}

interface TenantFindUniqueArgs {
  where: { slug: string };
}

interface TenantFindFirstArgs {
  where: { slug: string };
}

interface TenantCreateArgs {
  data: { slug: string; name: string; displayName: string; status: string; defaultLocale?: string; defaultCurrency?: string; timezone?: string };
}

interface UserCreateArgs {
  data: { firstName: string; lastName: string; email: string; passwordHash: string; tenantId: string; status: string; locale: string; timezone: string };
  include?: { tenant: boolean };
}

interface RoleFindFirstArgs {
  where: { name: string; tenantId: string };
}

interface UserRoleCreateArgs {
  data: { userId: string; roleId: string };
}

interface UserUpdateArgs {
  where: { id: string };
  data: { lastLoginAt?: Date; passwordHash?: string; emailVerified?: boolean; status?: string };
}

interface ApiKeyCreateArgs {
  data: { userId: string; name: string; keyHash: string; keyPrefix: string; permissions: string[]; expiresAt?: Date };
}

interface ApiKeyFindManyArgs {
  where: { userId: string };
  select: { id: true; name: true; keyPrefix: true; permissions: true; expiresAt: true; lastUsedAt: true; createdAt: true };
}

interface ApiKeyDeleteArgs {
  where: { id: string; userId: string };
}

interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  type?: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  status: string;
  emailVerified: boolean;
  locale: string;
  timezone: string;
  lastLoginAt: Date | null;
  tenant: {
    id: string;
    slug: string;
    name: string;
    displayName: string;
    status: string;
    defaultLocale: string;
    defaultCurrency: string;
    timezone: string;
  };
  userRoles: Array<{
    role: {
      id: string;
      name: string;
      permissions?: Array<{
        permission: {
          resource: string;
          action: string;
        };
      }>;
    };
  }>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    user: {
      findUnique<T = UserWithRelations | null>(args: UserFindUniqueArgs): Promise<T>;
      findFirst<T = UserWithRelations | null>(args: UserFindUniqueArgs): Promise<T>;
      create<T = UserWithRelations>(args: UserCreateArgs): Promise<T>;
      update<T = UserWithRelations>(args: UserUpdateArgs): Promise<T>;
    };
    tenant: {
      findUnique<T = { id: string; slug: string; name: string; displayName: string; status: string; defaultLocale: string; defaultCurrency: string; timezone: string } | null>(args: TenantFindUniqueArgs): Promise<T>;
      findFirst<T = { id: string; slug: string; name: string; displayName: string; status: string; defaultLocale: string; defaultCurrency: string; timezone: string } | null>(args: TenantFindFirstArgs): Promise<T>;
      create<T = { id: string; slug: string; name: string; displayName: string; status: string; defaultLocale: string; defaultCurrency: string; timezone: string }>(args: TenantCreateArgs): Promise<T>;
    };
    role: {
      findFirst<T = { id: string; name: string; tenantId: string } | null>(args: RoleFindFirstArgs): Promise<T>;
    };
    userRole: {
      create(args: UserRoleCreateArgs): Promise<{ id: string; userId: string; roleId: string; assignedAt: Date }>;
    };
    apiKey: {
      create<T = { id: string; name: string; keyPrefix: string; permissions: string[]; expiresAt: Date | null }>(args: ApiKeyCreateArgs): Promise<T>;
      findMany<T = { id: string; name: string; keyPrefix: string; permissions: string[]; expiresAt: Date | null; lastUsedAt: Date | null; createdAt: Date }[]>(args: ApiKeyFindManyArgs): Promise<T>;
      delete(args: ApiKeyDeleteArgs): Promise<{ id: string }>;
    };
  } {
    return this.prisma as PrismaService & {
      user: {
        findUnique<T = UserWithRelations | null>(args: UserFindUniqueArgs): Promise<T>;
        findFirst<T = UserWithRelations | null>(args: UserFindUniqueArgs): Promise<T>;
        create<T = UserWithRelations>(args: UserCreateArgs): Promise<T>;
        update<T = UserWithRelations>(args: UserUpdateArgs): Promise<T>;
      };
      tenant: {
        findUnique<T = { id: string; slug: string; name: string; displayName: string; status: string; defaultLocale: string; defaultCurrency: string; timezone: string } | null>(args: TenantFindUniqueArgs): Promise<T>;
        findFirst<T = { id: string; slug: string; name: string; displayName: string; status: string; defaultLocale: string; defaultCurrency: string; timezone: string } | null>(args: TenantFindFirstArgs): Promise<T>;
        create<T = { id: string; slug: string; name: string; displayName: string; status: string; defaultLocale: string; defaultCurrency: string; timezone: string }>(args: TenantCreateArgs): Promise<T>;
      };
      role: {
        findFirst<T = { id: string; name: string; tenantId: string } | null>(args: RoleFindFirstArgs): Promise<T>;
      };
      userRole: {
        create(args: UserRoleCreateArgs): Promise<{ id: string; userId: string; roleId: string; assignedAt: Date }>;
      };
      apiKey: {
        create<T = { id: string; name: string; keyPrefix: string; permissions: string[]; expiresAt: Date | null }>(args: ApiKeyCreateArgs): Promise<T>;
        findMany<T = { id: string; name: string; keyPrefix: string; permissions: string[]; expiresAt: Date | null; lastUsedAt: Date | null; createdAt: Date }[]>(args: ApiKeyFindManyArgs): Promise<T>;
        delete(args: ApiKeyDeleteArgs): Promise<{ id: string }>;
      };
    };
  }

  // ============================================
  // Login
  // ============================================

  async login(credentials: { email: string; password: string; tenantSlug?: string; rememberMe?: boolean }) {
    const { email, password, tenantSlug, rememberMe } = credentials;

    // Find user with tenant
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const user = await typedPrisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenant: true,
        userRoles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check tenant if provided
    if (tenantSlug && user.tenant.slug !== tenantSlug) {
      throw new UnauthorizedException('Invalid credentials for this tenant');
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash || '');
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check email verification
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user, rememberMe);

    // Update last login
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    await typedPrisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens
    };
  }

  // ============================================
  // Register
  // ============================================

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    tenantSlug?: string;
    tenantName?: string;
  }) {
    const { firstName, lastName, email, password, tenantSlug, tenantName } = data;

    const typedPrisma = this.getTypedPrisma();

    // Check if user exists
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const existingUser = await typedPrisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Determine tenant
    let tenant: { id: string; slug: string; name: string; displayName: string; status: string; defaultLocale: string; defaultCurrency: string; timezone: string } | null = null;
    if (tenantSlug) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      tenant = await typedPrisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
    } else if (tenantName) {
      // Create new tenant
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      tenant = await typedPrisma.tenant.create({
        data: {
          slug: this.generateSlug(tenantName),
          name: tenantName,
          displayName: tenantName,
          status: 'PENDING_SETUP',
          defaultLocale: 'en',
          defaultCurrency: 'USD',
          timezone: 'UTC'
        }
      });
    } else {
      // Use default/system tenant
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      tenant = await typedPrisma.tenant.findFirst({
        where: { slug: 'vashundhara' }
      });
      if (!tenant) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        tenant = await typedPrisma.tenant.create({
          data: {
            slug: 'vashundhara',
            name: 'Vashundhara Foundation',
            displayName: 'Vashundhara Foundation',
            status: 'ACTIVE',
            defaultLocale: 'en',
            defaultCurrency: 'USD',
            timezone: 'UTC'
          }
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await typedPrisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        passwordHash,
        tenantId: tenant!.id,
        status: 'PENDING_VERIFICATION',
        locale: tenant!.defaultLocale,
        timezone: tenant!.timezone
      },
      include: { tenant: true }
    });

    // Assign default role
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const memberRole = await typedPrisma.role.findFirst({
      where: { name: 'member', tenantId: tenant!.id }
    });

    if (memberRole) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await typedPrisma.userRole.create({
        data: {
          userId: user.id,
          roleId: memberRole.id
        }
      });
    }

    // Send verification email (would be implemented with notification service)
    // await this.sendVerificationEmail(user);

    // Generate tokens for the new user
    const tokens = await this.generateTokens(user, false);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType
    };
  }

  // ============================================
  // Token Management
  // ============================================

  async generateTokens(user: UserWithRelations, rememberMe = false) {
    const roles = user.userRoles?.map((ur) => ur.role.name) || [];
    const permissions = user.userRoles?.flatMap((ur) =>
      ur.role.permissions?.map((rp) => `${rp.permission.resource}:${rp.permission.action}`) || []
    ) || [];

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      permissions
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: rememberMe ? '7d' : '15m'
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: rememberMe ? '30d' : '7d' }
    );

    // Store refresh token in Redis
    const sessionId = uuidv4();
    await this.redis.setSession(sessionId, {
      userId: user.id,
      tenantId: user.tenantId,
      refreshToken,
      rememberMe
    }, rememberMe ? 30 * 86400 : 7 * 86400);

    return {
      accessToken,
      refreshToken,
      expiresIn: rememberMe ? 604800 : 900, // seconds
      tokenType: 'Bearer'
    };
  }

  async refreshTokens(refreshToken: string) {
    const typedPrisma = this.getTypedPrisma();
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const user = await typedPrisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          tenant: true,
          userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
        }
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  revokeTokens(_userId: string) {
    // Delete all sessions for user
    // This would require scanning Redis keys in production
    // For now, we'll just return success
    return { success: true };
  }

  // ============================================
  // Password Management
  // ============================================

  async requestPasswordReset(email: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await typedPrisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists
      return { success: true, message: 'If the email exists, a reset link will be sent' };
    }

    // Generate reset token
    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password-reset' },
      { expiresIn: '1h' }
    );

    // Store in Redis with 1 hour expiry
    await this.redis.set(`password-reset:${user.id}`, resetToken, 3600);

    // Send email (would use notification service)
    // await this.sendPasswordResetEmail(user, resetToken);

    return { success: true, message: 'If the email exists, a reset link will be sent' };
  }

  async resetPassword(token: string, password: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      if (payload.type !== 'password-reset') {
        throw new BadRequestException('Invalid token');
      }

      const storedToken = await this.redis.get(`password-reset:${payload.sub}`);
      if (storedToken !== token) {
        throw new BadRequestException('Invalid or expired token');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const typedPrisma = this.getTypedPrisma();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      await typedPrisma.user.update({
        where: { id: payload.sub },
        data: { passwordHash }
      });

      // Delete reset token
      await this.redis.del(`password-reset:${payload.sub}`);

      // Revoke all sessions
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.revokeTokens(payload.sub);

      return { success: true, message: 'Password reset successful' };
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await typedPrisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    await typedPrisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    // Revoke all sessions
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.revokeTokens(userId);

    return { success: true, message: 'Password changed successfully' };
  }

  // ============================================
  // Email Verification
  // ============================================

  async requestEmailVerification(userId: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await typedPrisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const verificationToken = this.jwtService.sign(
      { sub: user.id, type: 'email-verification' },
      { expiresIn: '24h' }
    );

    await this.redis.set(`email-verification:${user.id}`, verificationToken, 86400);

    // Send email
    // await this.sendVerificationEmail(user, verificationToken);

    return { success: true, message: 'Verification email sent' };
  }

  async verifyEmail(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      if (payload.type !== 'email-verification') {
        throw new BadRequestException('Invalid token');
      }

      const storedToken = await this.redis.get(`email-verification:${payload.sub}`);
      if (storedToken !== token) {
        throw new BadRequestException('Invalid or expired token');
      }

      const typedPrisma = this.getTypedPrisma();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      await typedPrisma.user.update({
        where: { id: payload.sub },
        data: { emailVerified: true, status: 'ACTIVE' }
      });

      await this.redis.del(`email-verification:${payload.sub}`);

      return { success: true, message: 'Email verified successfully' };
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  // ============================================
  // MFA
  // ============================================

  setupMFA(_userId: string) {
    // Implementation would use the MFA utilities from @vashundhara-foundation/auth
    return { secret: '', qrCodeUrl: '', backupCodes: [] };
  }

  verifyMFA(_userId: string, _code: string) {
    // Implementation would verify TOTP code
    return { success: true };
  }

  disableMFA(_userId: string) {
    // Implementation
    return { success: true };
  }

  // ============================================
  // API Keys
  // ============================================

  async createApiKey(userId: string, name: string, permissions: string[] = [], expiresAt?: Date) {
    const typedPrisma = this.getTypedPrisma();
    const keyPrefix = `vf_${uuidv4().slice(0, 8)}`;
    const key = `${keyPrefix}_${uuidv4().replace(/-/g, '')}`;
    const keyHash = await bcrypt.hash(key, 12);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const apiKey = await typedPrisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        keyPrefix,
        permissions,
        expiresAt
      }
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key, // Only returned once!
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt
    };
  }

  async listApiKeys(userId: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return typedPrisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true
      }
    });
  }

  async revokeApiKey(userId: string, keyId: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.apiKey.delete({
      where: { id: keyId, userId }
    });
    return { success: true };
  }

  // ============================================
  // Helpers
  // ============================================

  private sanitizeUser(user: UserWithRelations): SanitizedUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _passwordHash, ...sanitized } = user;
    return sanitized;
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}