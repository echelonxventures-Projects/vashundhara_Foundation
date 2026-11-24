/**
 * Permission Service for Vashundhara Foundation API
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { Prisma, PermissionAction } from '@vashundhara-foundation/database';

import { PrismaService } from '../../common/prisma/prisma.service';

// Permission type definitions
interface Permission {
  id: string;
  resource: string;
  action: PermissionAction;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const permissions = await this.prisma.permission.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      orderBy: [{ resource: 'asc' }, { action: 'asc' }]
    });

    // Group by resource
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const grouped = permissions.reduce((acc: Record<string, Permission[]>, p: Permission) => {
      if (!acc[p.resource]) {
        acc[p.resource] = [];
      }
      acc[p.resource].push(p);
      return acc;
    }, {} as Record<string, Permission[]>);

    return { permissions, grouped };
  }

  async findById(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const permission = await this.prisma.permission.findUnique({ where: { id } });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async create(data: { resource: string; action: PermissionAction; description?: string }) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const existing = await this.prisma.permission.findUnique({
      where: { resource_action: { resource: data.resource, action: data.action } }
    });

    if (existing) {
      throw new ConflictException('Permission already exists');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    return this.prisma.permission.create({ data });
  }

  async seedDefaultPermissions() {
    const resources = [
      'tenants', 'users', 'roles', 'permissions',
      'donations', 'campaigns', 'subscriptions', 'payments', 'invoices',
      'reports', 'settings', 'config', 'feature_flags',
      'translations', 'currencies', 'exchange_rates',
      'audit_logs', 'notifications', 'webhooks', 'files',
      'api_keys', 'sessions'
    ];

    const actions: PermissionAction[] = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE', 'EXPORT', 'IMPORT'];

    const permissions = resources.flatMap(resource =>
      actions.map(action => ({ resource, action }))
    );

    for (const perm of permissions) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.permission.upsert({
        where: { resource_action: { resource: perm.resource, action: perm.action } },
        update: {},
        create: perm
      });
    }

    return { success: true, count: permissions.length };
  }
}