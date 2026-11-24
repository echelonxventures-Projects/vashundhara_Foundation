/**
 * User Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import type { Prisma, LocaleCode } from '@vashundhara-foundation/database';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// User type definitions
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  lastLoginAt: Date | null;
  metadata: Record<string, unknown>;
  passwordHash?: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface UserWhereInput {
  tenantId?: string;
  deletedAt?: null | { not: null };
  email?: string;
  OR?: Array<Record<string, unknown>>;
  status?: string;
  userRoles?: { some: { role: { name: string } } };
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    user: {
      findMany<T = User[]>(args: { where?: UserWhereInput; skip?: number; take?: number; orderBy?: Prisma.UserOrderByWithRelationInput; select?: Prisma.UserSelect }): Promise<T>;
      count(args: { where?: UserWhereInput }): Promise<number>;
      findFirst<T = User | null>(args: { where: Prisma.UserWhereInput; select?: Prisma.UserSelect }): Promise<T>;
      findUnique<T = User | null>(args: { where: Prisma.UserWhereUniqueInput }): Promise<T>;
      create<T = User>(args: { data: Prisma.UserCreateInput }): Promise<T>;
      update<T = User>(args: { where: Prisma.UserWhereUniqueInput; data: Prisma.UserUpdateInput }): Promise<T>;
    };
    role: {
      findMany<T = { id: string }[]>(args: { where: Prisma.RoleWhereInput }): Promise<T>;
    };
    userRole: {
      createMany(args: { data: Prisma.UserRoleCreateInput[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
      deleteMany(args: { where: Prisma.UserRoleWhereInput }): Promise<{ count: number }>;
    };
  } {
    return this.prisma as PrismaService & {
      user: {
        findMany<T = User[]>(args: { where?: UserWhereInput; skip?: number; take?: number; orderBy?: Prisma.UserOrderByWithRelationInput; select?: Prisma.UserSelect }): Promise<T>;
        count(args: { where?: UserWhereInput }): Promise<number>;
        findFirst<T = User | null>(args: { where: Prisma.UserWhereInput; select?: Prisma.UserSelect }): Promise<T>;
        findUnique<T = User | null>(args: { where: Prisma.UserWhereUniqueInput }): Promise<T>;
        create<T = User>(args: { data: Prisma.UserCreateInput }): Promise<T>;
        update<T = User>(args: { where: Prisma.UserWhereUniqueInput; data: Prisma.UserUpdateInput }): Promise<T>;
      };
      role: {
        findMany<T = { id: string }[]>(args: { where: Prisma.RoleWhereInput }): Promise<T>;
      };
      userRole: {
        createMany(args: { data: Prisma.UserRoleCreateInput[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
        deleteMany(args: { where: Prisma.UserRoleWhereInput }): Promise<{ count: number }>;
      };
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const { page = 1, limit = 20, search, status, role, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: UserWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (role) {
      where.userRoles = {
        some: { role: { name: role } }
      };
    }

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.user.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
          locale: true,
          timezone: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: {
            include: { role: { select: { id: true, name: true, displayName: true } } }
          }
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.user.count({ where })
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(id: string) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await typedPrisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        locale: true,
        timezone: true,
        status: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        lastLoginAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: { role: { select: { id: true, name: true, displayName: true, description: true } } }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    locale?: string;
    timezone?: string;
    roles?: string[];
  }) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // Check email uniqueness
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const existing = await typedPrisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await typedPrisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        passwordHash,
        tenant: { connect: { id: tenantId } },
        locale: (data.locale || 'en') as LocaleCode,
        timezone: data.timezone || 'Asia/Kolkata',
        status: 'ACTIVE',
        emailVerified: true
      }
    });

    // Assign roles
    if (data.roles && data.roles.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const roles = await typedPrisma.role.findMany({
        where: { name: { in: data.roles }, tenantId }
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await typedPrisma.userRole.createMany({
        data: roles.map((role: { id: string }) => ({
          user: { connect: { id: user.id } },
          role: { connect: { id: role.id } }
        })),
        skipDuplicates: true
      });
    }

    const { passwordHash: _, ...sanitized } = user;
    return sanitized;
  }

  async update(id: string, data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
    locale?: string;
    timezone?: string;
    phone?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    metadata?: Record<string, unknown>;
    roles?: string[];
  }) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    await this.findById(id);

    // Update user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        locale: data.locale,
        timezone: data.timezone,
        phone: data.phone,
        status: data.status,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      }
    });

    // Update roles if provided
    if (data.roles) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.userRole.deleteMany({ where: { userId: id } });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const roles = await this.prisma.role.findMany({
        where: { name: { in: data.roles }, tenantId }
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.userRole.createMany({
        data: roles.map((role: { id: string }) => ({
          user: { connect: { id } },
          role: { connect: { id: role.id } }
        })),
        skipDuplicates: true
      });
    }

    // Remove passwordHash from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  async delete(id: string) {
    await this.findById(id);

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.user.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() }
    });

    return { success: true };
  }

  async updatePassword(id: string, currentPassword: string, newPassword: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const user = await typedPrisma.user.findFirst({
      where: { id, tenantId: this.tenantContext.getContext()?.tenantId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    return { success: true };
  }

  async getProfile(userId: string) {
    return this.findById(userId);
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
    locale?: string;
    timezone?: string;
    phone?: string;
  }) {
    return this.update(userId, data);
  }
}