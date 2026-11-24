import { BadRequestException, Controller, Get, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JobStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { requireUser, runAsSystem } from '../../common/context/context';
import { TenantResolver } from '../../common/http/context.middleware';
import { PageQuery, Paging, PlatformAdmin, ZBody, ZQuery } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';

const TenantUpdate = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_SETUP', 'ARCHIVED']), primaryDomain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/).nullable() }).partial();
const Fcra = z.object({ verified: z.boolean(), note: z.string().min(5).max(500) });
const UserUpdate = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });
const JobQuery = PageQuery.extend({ status: z.enum(JobStatus).optional() });

/** Platform operator console. Every call runs unscoped, so every change is audited. */
@ApiTags('platform')
@Controller('platform')
@PlatformAdmin()
export class PlatformController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly tenants: TenantResolver) {}

  @Get('overview')
  overview() {
    return runAsSystem(async () => {
      const [tenants, users, donations, deadJobs] = await Promise.all([
        this.prisma.tenant.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.donation.aggregate({ where: { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] }, currency: 'INR' }, _sum: { amountMinor: true, refundedMinor: true }, _count: true }),
        this.prisma.job.count({ where: { status: 'DEAD' } })
      ]);
      return { tenants: Object.fromEntries(tenants.map((t) => [t.status, t._count])), users, donations: donations._count, raisedMinor: (donations._sum.amountMinor ?? 0n) - (donations._sum.refundedMinor ?? 0n), deadJobs };
    });
  }
  @Get('tenants')
  list(@ZQuery(PageQuery) p: Paging) {
    return runAsSystem(async () => {
      const where: Prisma.TenantWhereInput = { deletedAt: null, ...(p.q ? { OR: [{ name: { contains: p.q, mode: 'insensitive' } }, { slug: { contains: p.q } }] } : {}) };
      const [items, total] = await Promise.all([
        this.prisma.tenant.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, include: { _count: { select: { memberships: true, campaigns: true, donations: true } }, complianceProfile: true } }),
        this.prisma.tenant.count({ where })
      ]);
      return { items, total, page: p.page, limit: p.limit };
    });
  }
  @Put('tenants/:id')
  update(@Param('id') id: string, @ZBody(TenantUpdate) b: z.infer<typeof TenantUpdate>) {
    return runAsSystem(async () => {
      const before = await this.prisma.tenant.findUnique({ where: { id }, include: { complianceProfile: true } });
      if (!before) throw new NotFoundException('NGO not found');
      if (b.status === 'ACTIVE' && !before.complianceProfile) throw new BadRequestException('Compliance details must be filled in before approval');
      const t = await this.prisma.tenant.update({ where: { id }, data: b });
      await this.tenants.invalidate(before);
      await this.tenants.invalidate(t);
      await this.audit.log('APPROVE', 'tenant', id, { status: before.status, primaryDomain: before.primaryDomain }, b, { tenantId: id });
      return t;
    });
  }
  @Put('tenants/:id/fcra')
  fcra(@Param('id') id: string, @ZBody(Fcra) b: z.infer<typeof Fcra>) {
    return runAsSystem(async () => {
      const c = await this.prisma.complianceProfile.findUnique({ where: { tenantId: id } });
      if (!c?.fcraNo || !c.fcraValidUntil || c.fcraValidUntil < new Date()) throw new BadRequestException('No valid FCRA registration on file');
      await this.prisma.complianceProfile.update({ where: { tenantId: id }, data: b.verified ? { fcraVerifiedAt: new Date(), fcraVerifiedById: requireUser().id } : { fcraVerifiedAt: null, fcraVerifiedById: null } });
      await this.audit.log('APPROVE', 'fcra', id, undefined, b, { tenantId: id });
      return { ok: true };
    });
  }
  @Get('users')
  users(@ZQuery(PageQuery) p: Paging) {
    return runAsSystem(async () => {
      const where: Prisma.UserWhereInput = p.q ? { OR: [{ email: { contains: p.q, mode: 'insensitive' } }, { lastName: { contains: p.q, mode: 'insensitive' } }] } : {};
      const [items, total] = await Promise.all([
        this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, select: { id: true, email: true, firstName: true, lastName: true, status: true, isSystemAdmin: true, mfaEnabled: true, lastLoginAt: true, memberships: { select: { tenant: { select: { slug: true } } } } } }),
        this.prisma.user.count({ where })
      ]);
      return { items, total, page: p.page, limit: p.limit };
    });
  }
  @Put('users/:id')
  updateUser(@Param('id') id: string, @ZBody(UserUpdate) b: z.infer<typeof UserUpdate>) {
    if (id === requireUser().id) throw new BadRequestException('You cannot change your own account here');
    return runAsSystem(async () => {
      await this.prisma.user.update({ where: { id }, data: b });
      if (b.status === 'SUSPENDED') await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log('UPDATE', 'user', id, undefined, b, { tenantId: null });
      return { ok: true };
    });
  }
  @Get('jobs')
  jobs(@ZQuery(JobQuery) p: z.infer<typeof JobQuery>) {
    return runAsSystem(async () => {
      const where = p.status ? { status: p.status } : {};
      const [items, total] = await Promise.all([
        this.prisma.job.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, select: { id: true, type: true, tenantId: true, status: true, attempts: true, lastError: true, runAt: true, createdAt: true } }),
        this.prisma.job.count({ where })
      ]);
      return { items, total, page: p.page, limit: p.limit };
    });
  }
  @Post('jobs/:id/retry')
  retry(@Param('id') id: string) {
    return runAsSystem(async () => {
      const { count } = await this.prisma.job.updateMany({ where: { id, status: 'DEAD' }, data: { status: 'QUEUED', attempts: 0, runAt: new Date(), finishedAt: null } });
      if (!count) throw new NotFoundException('Job not found');
      await this.audit.log('UPDATE', 'job', id, undefined, { retry: true }, { tenantId: null });
      return { ok: true };
    });
  }
  @Get('audit')
  auditLog(@ZQuery(PageQuery) p: Paging) {
    return runAsSystem(async () => {
      const [items, total] = await Promise.all([
        this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, include: { user: { select: { email: true } }, tenant: { select: { slug: true } } } }),
        this.prisma.auditLog.count()
      ]);
      return { items, total, page: p.page, limit: p.limit };
    });
  }
}
@Module({ controllers: [PlatformController] })
export class PlatformModule {}
