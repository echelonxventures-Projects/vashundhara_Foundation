import { BadRequestException, Controller, Get, HttpCode, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataRequestStatus, DataRequestType, Prisma } from '@prisma/client';
import { verifyPassword } from '@vashundhara-foundation/auth';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { Can, PageQuery, Paging, RateLimit, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { StructureService } from '../../common/structure/structure.service';

const Ask = z.object({ type: z.enum(DataRequestType), details: z.string().max(2000).optional(), password: z.string().max(200).optional() });
const Handle = z.object({ status: z.enum(DataRequestStatus), resolution: z.string().min(5).max(2000) });
const Consent = z.object({ purpose: z.enum(['marketing', 'photos']), granted: z.boolean() });

@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly structure: StructureService) {}

  /** Everything this NGO holds about the signed-in person. */
  @Get('export') @SelfService() @RateLimit(5, 3600)
  async export() {
    const u = requireUser();
    const mine = { OR: [{ userId: u.id }, ...(u.emailVerified ? [{ userId: null, email: u.email }] : [])] };
    const [profile, donors, volunteer, beneficiaries, students, consents, events, feedback] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: u.id }, select: { email: true, firstName: true, lastName: true, phone: true, locale: true, createdAt: true } }),
      this.prisma.donor.findMany({ where: mine, omit: { panEnc: true, notes: true, tags: true }, include: { donations: { omit: { publicToken: true }, include: { receipts: { select: { number: true, issuedAt: true, status: true } } } } } }),
      this.prisma.volunteer.findMany({ where: { userId: u.id }, omit: { notes: true, tags: true }, include: { hoursLogs: true, shiftAssignments: true, certificates: true } }),
      this.prisma.beneficiary.findMany({ where: { userId: u.id }, omit: { notes: true }, include: { cases: true, aidRecords: true } }),
      this.prisma.student.findMany({ where: { userId: u.id }, omit: { notes: true }, include: { enrolments: true, submissions: true, attendance: true } }),
      this.prisma.consentRecord.findMany({ where: { OR: [{ userId: u.id }, { email: u.email }] } }), this.prisma.eventRegistration.findMany({ where: { email: u.email } }), this.prisma.feedback.findMany({ where: { userId: u.id } })
    ]);
    const people = [...donors.map((x) => ({ entity: 'donors', id: x.id })), ...volunteer.map((x) => ({ entity: 'volunteers', id: x.id })), ...beneficiaries.map((x) => ({ entity: 'beneficiaries', id: x.id })), ...students.map((x) => ({ entity: 'students', id: x.id }))];
    const more = await this.structure.personalExport(u, people);
    await this.audit.log('EXPORT', 'personalData', u.id);
    return { generatedAt: new Date(), organisation: requireTenant().name, profile, donors, volunteer, beneficiaries, students, consents, events, feedback, more };
  }
  @Get('requests/mine') @SelfService()
  async mine() { return { items: await this.prisma.dataRequest.findMany({ where: { userId: requireUser().id }, orderBy: { createdAt: 'desc' } }) }; }
  @Post('requests') @SelfService() @RateLimit(5, 86_400)
  async ask(@ZBody(Ask) b: z.infer<typeof Ask>) {
    const u = requireUser();
    if (b.type === 'ERASURE') {
      const row = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      if (row.passwordHash && !(await verifyPassword(b.password ?? '', row.passwordHash))) throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Confirm with your password' });
    }
    if (await this.prisma.dataRequest.findFirst({ where: { userId: u.id, type: b.type, status: { in: ['OPEN', 'IN_PROGRESS'] } } })) throw new BadRequestException('You already have an open request of this kind');
    return this.prisma.dataRequest.create({ data: { tenantId: requireTenant().id, userId: u.id, type: b.type, details: b.details } });
  }
  @Put('consents') @SelfService() @HttpCode(200)
  async consent(@ZBody(Consent) b: z.infer<typeof Consent>) {
    const u = requireUser();
    await this.prisma.consentRecord.create({ data: { tenantId: requireTenant().id, userId: u.id, email: u.email, version: '1', ipAddress: getCtx()?.ip, ...b } });
    if (b.purpose === 'marketing') await this.prisma.donor.updateMany({ where: { userId: u.id }, data: { marketingConsent: b.granted } });
    return { ok: true };
  }

  @Get('requests') @Can('privacy:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const [items, total] = await Promise.all([this.prisma.dataRequest.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], skip: (p.page - 1) * p.limit, take: p.limit }), this.prisma.dataRequest.count()]);
    const users = await this.prisma.user.findMany({ where: { id: { in: items.map((i) => i.userId) } }, select: { id: true, email: true } });
    return { items: items.map((i) => ({ ...i, email: users.find((u) => u.id === i.userId)?.email })), total, page: p.page, limit: p.limit };
  }
  @Put('requests/:id') @Can('privacy:manage')
  async handle(@Param('id') id: string, @ZBody(Handle) b: z.infer<typeof Handle>) {
    const r = await this.prisma.dataRequest.findFirst({ where: { id } });
    if (!r || ['COMPLETED', 'REJECTED'].includes(r.status)) throw new NotFoundException('No open request');
    if (r.type === 'ERASURE' && b.status === 'COMPLETED') await this.erase(r.userId);
    await this.prisma.dataRequest.update({ where: { id }, data: { status: b.status, resolution: b.resolution, handledById: requireUser().id, completedAt: ['COMPLETED', 'REJECTED'].includes(b.status) ? new Date() : null } });
    await this.audit.log('UPDATE', 'dataRequest', id, { status: r.status }, b);
    return { ok: true };
  }
  /**
   * Removes the person from this NGO. Donation, receipt and ledger records are kept because tax law
   * requires them; donor details on those records are the minimum needed. Other NGOs are not affected.
   */
  private async erase(userId: string) {
    const gone = 'Removed on request';
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    const email = u?.email ?? '-';
    await this.prisma.$transaction(async (tx) => {
      const donors = await tx.donor.findMany({ where: { userId }, include: { _count: { select: { donations: true } } } });
      for (const d of donors) {
        await tx.donor.update({ where: { id: d.id }, data: d._count.donations ? { userId: null, phone: null, notes: null, tags: [], marketingConsent: false } : { userId: null, fullName: gone, email: null, phone: null, address: Prisma.DbNull, panEnc: null, panLast4: null, notes: null, deletedAt: new Date() } });
      }
      const when = new Date();
      const people = [...donors.map((x) => ({ entity: 'donors', id: x.id })), ...(await Promise.all([['volunteers', tx.volunteer], ['beneficiaries', tx.beneficiary], ['students', tx.student]].map(async ([entity, m]: any) => (await m.findMany({ where: { userId }, select: { id: true } })).map((x: { id: string }) => ({ entity, id: x.id }))))).flat()];
      if (u) await this.structure.erasePersonal(tx, u, people);
      for (const v of await tx.volunteer.findMany({ where: { userId } })) await tx.volunteer.update({ where: { id: v.id }, data: { userId: null, firstName: gone, lastName: '', email: `erased-${v.id}@invalid.local`, phone: null, mobile: null, whatsapp: null, dateOfBirth: null, gender: null, address: {}, emergencyContact: {}, occupation: null, employer: null, education: null, notes: null, documents: [], deletedAt: when } });
      await tx.beneficiary.updateMany({ where: { userId }, data: { userId: null, fullName: gone, guardianName: null, email: null, phone: null, dateOfBirth: null, address: {}, idLast4: null, need: null, notes: null, deletedAt: when } });
      await tx.student.updateMany({ where: { userId }, data: { userId: null, fullName: gone, email: null, phone: null, guardianName: null, guardianPhone: null, dateOfBirth: null, school: null, notes: null, deletedAt: when } });
      await tx.submission.updateMany({ where: { student: { deletedAt: when } }, data: { text: null, feedback: null } });
      await tx.eventRegistration.updateMany({ where: { email }, data: { name: gone, phone: null, userId: null } });
      await tx.newsletterSubscriber.deleteMany({ where: { email } });
      await tx.contactMessage.deleteMany({ where: { email } });
      await tx.feedback.updateMany({ where: { userId }, data: { authorName: null, comment: null, status: 'HIDDEN' } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.apiKey.updateMany({ where: { userId }, data: { revokedAt: when } });
      await tx.membership.deleteMany({ where: { userId } });
      const left = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM memberships WHERE "userId" = ${userId}`;
      if (Number(left[0].n) === 0 && !u?.isSystemAdmin) {
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: when } });
        await tx.user.update({ where: { id: userId }, data: { email: `erased-${userId}@invalid.local`, firstName: gone, lastName: '', displayName: null, phone: null, passwordHash: null, googleSub: null, avatarUrl: null, mfaEnabled: false, mfaSecretEnc: null, mfaBackupHashes: [], status: 'DELETED', deletedAt: when } });
      }
    });
  }
}
@Module({ controllers: [PrivacyController] })
export class PrivacyModule {}
