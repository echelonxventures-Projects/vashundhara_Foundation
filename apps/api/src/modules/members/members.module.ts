import { BadRequestException, Controller, Delete, ForbiddenException, Get, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionAction, Prisma } from '@prisma/client';
import { randomToken, sha256 } from '@vashundhara-foundation/auth';
import { ALL_PERMISSIONS, hasPermission } from '@vashundhara-foundation/shared';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { TenantResolver } from '../../common/http/context.middleware';
import { Can, PageQuery, Paging, ZBody, ZQuery } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { Email } from '../auth/auth.module';
import { NotificationsService } from '../notifications/notifications.module';

const roleInclude = { permissions: { include: { permission: true } } } as const;
type RoleWithPerms = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;
const permsOf = (r: RoleWithPerms) => r.permissions.map((p) => `${p.permission.resource}:${p.permission.action.toLowerCase()}`);

/** Nobody can hand out access they do not hold themselves. */
function assertGrantable(perms: string[]) {
  const mine = getCtx()!.permissions;
  const missing = perms.filter((p) => !hasPermission(mine, p));
  if (missing.length) throw new ForbiddenException(`You cannot grant access you do not have: ${missing.slice(0, 5).join(', ')}`);
}

const InviteSchema = z.object({ email: Email, roleIds: z.array(z.string().max(60)).min(1).max(10), organizationId: z.string().max(60).optional() });
const UpdateSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional(), roleIds: z.array(z.string().max(60)).max(10).optional(), organizationId: z.string().max(60).nullish() });

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notify: NotificationsService, private readonly tenants: TenantResolver) {}

  @Get() @Can('members:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.MembershipWhereInput = p.q
      ? { user: { OR: [{ email: { contains: p.q, mode: 'insensitive' } }, { firstName: { contains: p.q, mode: 'insensitive' } }, { lastName: { contains: p.q, mode: 'insensitive' } }] } }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.membership.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, lastLoginAt: true, mfaEnabled: true } }, roles: { include: { role: { select: { id: true, name: true, displayName: true } } } } }
      }),
      this.prisma.membership.count({ where })
    ]);
    return { items: rows.map((m) => ({ ...m, roles: m.roles.map((r) => r.role) })), total, page: p.page, limit: p.limit };
  }

  private async grantable(roleIds: string[]) {
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, scope: 'TENANT', deletedAt: null }, include: roleInclude });
    if (roles.length !== new Set(roleIds).size) throw new BadRequestException('Unknown role');
    assertGrantable(roles.flatMap(permsOf));
    return roles;
  }

  @Put(':id') @Can('members:update')
  async update(@Param('id') id: string, @ZBody(UpdateSchema) b: z.infer<typeof UpdateSchema>) {
    const m = await this.prisma.membership.findFirst({ where: { id }, include: { roles: { include: { role: { include: roleInclude } } } } });
    if (!m) throw new NotFoundException('Member not found');
    if (m.userId === requireUser().id) throw new BadRequestException('You cannot change your own access');
    assertGrantable(m.roles.flatMap((r) => permsOf(r.role)));
    if (b.roleIds) await this.grantable(b.roleIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({ where: { id }, data: { status: b.status, organizationId: b.organizationId } });
      if (b.roleIds) {
        await tx.membershipRole.deleteMany({ where: { membershipId: id } });
        await tx.membershipRole.createMany({ data: b.roleIds.map((roleId) => ({ membershipId: id, roleId, assignedBy: requireUser().id })) });
      }
    });
    await this.audit.log('PERMISSION_CHANGE', 'membership', id, { status: m.status, roles: m.roles.map((r) => r.role.name) }, b);
    return { ok: true };
  }

  @Delete(':id') @Can('members:delete')
  async remove(@Param('id') id: string) {
    const m = await this.prisma.membership.findFirst({ where: { id }, include: { roles: { include: { role: { include: roleInclude } } } } });
    if (!m) throw new NotFoundException('Member not found');
    if (m.userId === requireUser().id) throw new BadRequestException('You cannot remove yourself');
    assertGrantable(m.roles.flatMap((r) => permsOf(r.role)));
    await this.prisma.$transaction([
      this.prisma.apiKey.updateMany({ where: { userId: m.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.membership.delete({ where: { id } })
    ]);
    await this.audit.log('DELETE', 'membership', id, { userId: m.userId });
    return { ok: true };
  }

  @Get('invitations') @Can('members:read')
  async invitations() {
    return { items: await this.prisma.invitation.findMany({ where: { acceptedAt: null, revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 100, omit: { tokenHash: true } }) };
  }

  @Post('invitations') @Can('members:create')
  async invite(@ZBody(InviteSchema) b: z.infer<typeof InviteSchema>) {
    await this.grantable(b.roleIds);
    const tenant = requireTenant();
    const me = requireUser();
    if (b.organizationId && !(await this.prisma.organization.findFirst({ where: { id: b.organizationId } }))) throw new BadRequestException('Unknown organisation');
    const token = randomToken();
    await this.prisma.invitation.updateMany({ where: { email: b.email, acceptedAt: null }, data: { revokedAt: new Date() } });
    const i = await this.prisma.invitation.create({ data: { tenantId: tenant.id, email: b.email, roleIds: b.roleIds, organizationId: b.organizationId, tokenHash: sha256(token), invitedById: me.id, expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    await this.notify.send({ template: 'member.invite', to: b.email, vars: { inviter: `${me.firstName} ${me.lastName}`, link: `${this.tenants.url(tenant)}/${tenant.defaultLocale}/invite#token=${token}` } });
    await this.audit.log('INVITE', 'invitation', i.id, undefined, b);
    return { id: i.id };
  }

  @Delete('invitations/:id') @Can('members:delete')
  async revoke(@Param('id') id: string) {
    const { count } = await this.prisma.invitation.updateMany({ where: { id, acceptedAt: null }, data: { revokedAt: new Date() } });
    if (!count) throw new NotFoundException('Invitation not found');
    return { ok: true };
  }
}

const RoleSchema = z.object({ name: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/), displayName: z.string().min(2).max(60), description: z.string().max(300).optional(), permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(300) });
const RoleUpdate = RoleSchema.omit({ name: true }).partial();

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get() @Can('roles:read')
  async list() {
    const roles = await this.prisma.role.findMany({ where: { scope: 'TENANT', deletedAt: null }, include: roleInclude, orderBy: { priority: 'desc' } });
    return { items: roles.map((r) => ({ id: r.id, name: r.name, displayName: r.displayName, description: r.description, isSystem: r.isSystem, permissions: permsOf(r) })) };
  }
  @Get('permissions') @Can('roles:read')
  permissions() { return { items: ALL_PERMISSIONS.filter((p) => !p.startsWith('platform:') && p !== 'tenants:manage') }; }

  private async permissionIds(perms: string[]) {
    assertGrantable(perms);
    const rows = await this.prisma.permission.findMany({ where: { OR: perms.map((p) => ({ resource: p.split(':')[0], action: p.split(':')[1].toUpperCase() as PermissionAction })) } });
    return rows.map((r) => r.id);
  }
  @Post() @Can('roles:create')
  async create(@ZBody(RoleSchema) b: z.infer<typeof RoleSchema>) {
    const ids = await this.permissionIds(b.permissions);
    if (await this.prisma.role.findFirst({ where: { name: b.name, deletedAt: null } })) throw new BadRequestException('A role with that name exists');
    const r = await this.prisma.role.create({ data: { tenantId: requireTenant().id, name: b.name, displayName: b.displayName, description: b.description, permissions: { create: ids.map((permissionId) => ({ permissionId })) } } });
    await this.audit.log('CREATE', 'role', r.id, undefined, b);
    return { id: r.id };
  }
  private async own(id: string) {
    const r = await this.prisma.role.findFirst({ where: { id, tenantId: requireTenant().id, deletedAt: null }, include: { ...roleInclude, _count: { select: { memberRoles: true } } } });
    if (!r) throw new NotFoundException('Only your own custom roles can be changed');
    assertGrantable(permsOf(r));
    return r;
  }
  @Put(':id') @Can('roles:update')
  async update(@Param('id') id: string, @ZBody(RoleUpdate) b: z.infer<typeof RoleUpdate>) {
    const r = await this.own(id);
    const ids = b.permissions ? await this.permissionIds(b.permissions) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { displayName: b.displayName, description: b.description } });
      if (ids) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: id, permissionId })) });
      }
    });
    await this.audit.log('PERMISSION_CHANGE', 'role', id, { permissions: permsOf(r) }, b);
    return { ok: true };
  }
  @Delete(':id') @Can('roles:delete')
  async remove(@Param('id') id: string) {
    const r = await this.own(id);
    if (r._count.memberRoles) throw new BadRequestException('Remove this role from members first');
    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date(), name: `${r.name}_deleted_${Date.now()}` } });
    await this.audit.log('DELETE', 'role', id, { name: r.name });
    return { ok: true };
  }
}

const KeySchema = z.object({ name: z.string().min(1).max(60), permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).min(1).max(100), expiresInDays: z.number().int().min(1).max(365) });

@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  @Get() @Can('api_keys:read')
  async list() { return { items: await this.prisma.apiKey.findMany({ where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, omit: { keyHash: true } }) }; }
  @Post() @Can('api_keys:create')
  async create(@ZBody(KeySchema) b: z.infer<typeof KeySchema>) {
    if (!getCtx()?.sessionId) throw new ForbiddenException('API keys cannot create API keys');
    assertGrantable(b.permissions);
    const me = requireUser();
    if (!me.membershipId) throw new ForbiddenException('Join this organisation first');
    const key = `vf_${randomToken(32)}`;
    const k = await this.prisma.apiKey.create({ data: { tenantId: requireTenant().id, userId: me.id, name: b.name, permissions: b.permissions, keyHash: sha256(key), keyPrefix: key.slice(0, 10), expiresAt: new Date(Date.now() + b.expiresInDays * 86400_000) } });
    await this.audit.log('CREATE', 'apiKey', k.id, undefined, { name: b.name, permissions: b.permissions });
    return { id: k.id, key };
  }
  @Delete(':id') @Can('api_keys:delete')
  async revoke(@Param('id') id: string) {
    const { count } = await this.prisma.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!count) throw new NotFoundException('Key not found');
    await this.audit.log('DELETE', 'apiKey', id);
    return { ok: true };
  }
}

@Module({ controllers: [MembersController, RolesController, ApiKeysController] })
export class MembersModule {}
