/**
 * Role Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// Role type definitions
interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  scope: 'SYSTEM' | 'TENANT';
  priority: number;
  tenantId: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface RoleWhereInput {
  id?: string;
  deletedAt?: null | { not: null };
  tenantId?: string;
  scope?: 'SYSTEM' | 'TENANT';
  OR?: Array<{ tenantId?: string; scope?: 'SYSTEM' | 'TENANT' }>;
  AND?: Array<Record<string, unknown>>;
  name?: string | { contains: string; mode: 'insensitive' };
  displayName?: string | { contains: string; mode: 'insensitive' };
}

interface RoleWithRelations extends Role {
  permissions: Array<{ permission: { id: string; resource: string; action: string } }>;
  _count: { userRoles: number };
}

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    scope?: 'SYSTEM' | 'TENANT';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const { page = 1, limit = 20, search, scope, sortBy = 'priority', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: RoleWhereInput = { deletedAt: null };

    if (!isSystemAdmin) {
      where.OR = [
        { tenantId },
        { scope: 'SYSTEM' }
      ];
    } else if (scope) {
      where.scope = scope;
    } else if (tenantId) {
      where.OR = [
        { tenantId },
        { scope: 'SYSTEM' }
      ];
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.prisma.role.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          permissions: {
            include: { permission: true }
          },
          _count: { select: { userRoles: true } }
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.prisma.role.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const where: RoleWhereInput = { deletedAt: null };

    if (!isSystemAdmin) {
      where.OR = [
        { tenantId },
        { scope: 'SYSTEM' }
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const role = await this.prisma.role.findFirst({
      where: { id, ...where },
      include: {
        permissions: {
          include: { permission: true }
        },
        _count: { select: { userRoles: true } }
      }
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async create(data: {
    name: string;
    displayName: string;
    description?: string;
    scope?: 'SYSTEM' | 'TENANT';
    priority?: number;
    permissionIds?: string[];
  }) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    if (!isSystemAdmin && data.scope === 'SYSTEM') {
      throw new ForbiddenException('Only system admins can create system roles');
    }

    // Check name uniqueness within scope
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const existing = await this.prisma.role.findFirst({
      where: {
        name: data.name,
        scope: data.scope || 'TENANT',
        tenantId: data.scope === 'SYSTEM' ? null : (tenantId || undefined)
      }
    });

    if (existing) {
      throw new ConflictException('Role with this name already exists');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        scope: data.scope || 'TENANT',
        priority: data.priority || 0,
        tenant: data.scope === 'SYSTEM' ? undefined : { connect: { id: tenantId } },
        isSystem: data.scope === 'SYSTEM',
        permissions: data.permissionIds ? {
          create: data.permissionIds.map(permissionId => ({ permission: { connect: { id: permissionId } } }))
        } : undefined
      },
      include: { permissions: { include: { permission: true } } }
    });

    return role;
  }

  async update(id: string, data: {
    displayName?: string;
    description?: string;
    priority?: number;
    permissionIds?: string[];
  }) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const role = await this.findById(id);

    if (role.isSystem && !isSystemAdmin) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        displayName: data.displayName,
        description: data.description,
        priority: data.priority,
        permissions: data.permissionIds ? {
          deleteMany: {},
          create: data.permissionIds.map(permissionId => ({ permission: { connect: { id: permissionId } } }))
        } : undefined
      },
      include: { permissions: { include: { permission: true } } }
    });

    return updated;
  }

  async delete(id: string) {
    const role = await this.findById(id);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    if (role._count.userRoles > 0) {
      throw new BadRequestException('Cannot delete role with assigned users');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return { success: true };
  }

  async assignPermissions(roleId: string, permissionIds: string[]) {
    await this.findById(roleId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({ roleId, permissionId })),
      skipDuplicates: true
    });

    return this.findById(roleId);
  }
}