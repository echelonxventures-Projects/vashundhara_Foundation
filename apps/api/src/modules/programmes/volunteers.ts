import { BadRequestException, ConflictException, Controller, Get, HttpCode, Module, NotFoundException, OnModuleInit, Param, Post, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActivityType, Gender, Prisma, ProficiencyLevel, ShiftStatus, VolunteerStatus } from '@prisma/client';
import { randomToken } from '@vashundhara-foundation/auth';
import type { Response } from 'express';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { requireTenant, requireUser, runAsTenant } from '../../common/context/context';
import { crudController } from '../../common/crud/crud';
import { TenantResolver } from '../../common/http/context.middleware';
import { Can, PageQuery, Paging, Public, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { JobsService } from '../../common/jobs/jobs.module';
import { TextPdf } from '../../common/pdf/pdf-text';
import { PrismaService } from '../../common/prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.module';

const text = (n: number) => z.string().trim().min(1).max(n);
const opt = (n: number) => z.string().trim().max(n).nullish();
const list = z.array(z.string().max(40)).max(30).optional();
const when = (d: Date, tz: string) => d.toLocaleString('en-IN', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' });

const Profile = z.object({ firstName: text(80), lastName: text(80), phone: opt(20), dateOfBirth: z.coerce.date().nullish(), gender: z.enum(Gender).nullish(), address: z.record(z.string().max(30), z.string().max(200)).nullish(), emergencyContact: z.record(z.string().max(30), z.string().max(100)).nullish(), occupation: opt(100), education: opt(100), skills: list, interests: list, languages: list });
const Volunteers = crudController({
  path: 'volunteers', resource: 'volunteers', model: 'volunteer', search: ['firstName', 'lastName', 'email', 'phone'], filters: ['status', 'skills', 'interests'], sort: ['lastName', 'totalHours'],
  schema: Profile.extend({ email: z.email(), status: z.enum(VolunteerStatus).optional(), notes: opt(2000), tags: list }),
  only: ['list', 'get', 'create', 'update', 'delete']
});
const Shifts = crudController({
  path: 'shifts', resource: 'shifts', model: 'shift', search: ['title', 'location'], filters: ['status'], sort: ['startDateTime'], defaultSort: { startDateTime: 'desc' }, include: { _count: { select: { assignments: { where: { status: { in: ['REGISTERED', 'CONFIRMED', 'ATTENDED'] } } } } } },
  schema: z.object({ title: text(150), description: opt(3000), location: opt(200), startDateTime: z.coerce.date(), endDateTime: z.coerce.date(), timezone: z.string().max(60).optional(), maxVolunteers: z.number().int().min(1).max(10_000).optional(), requiredSkills: list, status: z.enum(ShiftStatus).optional(), contactPerson: opt(100), contactPhone: opt(20), contactEmail: z.email().nullish(), tags: list }),
  prepare: (d, { existing }) => {
    const s = d.startDateTime ?? existing?.startDateTime;
    const e = d.endDateTime ?? existing?.endDateTime;
    if (e <= s) throw new BadRequestException('The shift must end after it starts');
    return d;
  }
});
const Skills = crudController({ path: 'skills', resource: 'volunteers', model: 'skill', search: ['name'], filters: ['category'], schema: z.object({ name: text(80), category: opt(60), description: opt(500), isCertifiable: z.boolean().optional() }) });

const Decision = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'ON_HOLD', 'ALUMNI', 'BLACKLISTED']) });
const HoursIn = z.object({ volunteerId: z.string().max(60), shiftId: z.string().max(60).nullish(), date: z.coerce.date(), hours: z.number().min(0.25).max(24), description: opt(500), activityType: z.enum(ActivityType).optional() });
const HoursDecision = z.object({ status: z.enum(['APPROVED', 'REJECTED']) });
const CertIn = z.object({ volunteerId: z.string().max(60), title: text(120) });
const SkillIn = z.object({ skillId: z.string().max(60), proficiency: z.enum(ProficiencyLevel) });
const AvailIn = z.object({ slots: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })).max(30) });
const Assign = z.object({ volunteerId: z.string().max(60) });
const SEATED = ['REGISTERED', 'CONFIRMED', 'ATTENDED'] as ('REGISTERED' | 'CONFIRMED' | 'ATTENDED')[];

@ApiTags('volunteers')
@Controller('volunteering')
export class VolunteeringController implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notify: NotificationsService, private readonly jobs: JobsService, private readonly tenants: TenantResolver) {}
  onModuleInit() { this.jobs.every(3600, 'shifts.remind', () => this.remind()); }

  private async me() {
    const v = await this.prisma.volunteer.findFirst({ where: { userId: requireUser().id, deletedAt: null } });
    if (!v) throw new NotFoundException({ code: 'NO_PROFILE', message: 'Complete your volunteer profile first' });
    return v;
  }
  /** Locks the shift so the last place cannot be taken twice. */
  private async seat(shiftId: string, volunteer: { id: string; firstName: string; email: string; userId: string | null }, staff: boolean) {
    const tenantId = requireTenant().id;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shifts WHERE id = ${shiftId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      const s = await tx.shift.findFirst({ where: { id: shiftId, deletedAt: null } });
      if (!s || (!staff && !['PUBLISHED', 'FULL'].includes(s.status)) || s.status === 'CANCELLED') throw new NotFoundException('Shift not found');
      if (s.endDateTime < new Date()) throw new BadRequestException('This shift is over');
      const clash = await tx.shiftAssignment.findFirst({ where: { volunteerId: volunteer.id, status: { in: SEATED }, shift: { id: { not: s.id }, startDateTime: { lt: s.endDateTime }, endDateTime: { gt: s.startDateTime } } } });
      if (clash) throw new ConflictException({ code: 'CLASH', message: 'This overlaps another shift' });
      const taken = await tx.shiftAssignment.count({ where: { shiftId, status: { in: SEATED } } });
      const existing = await tx.shiftAssignment.findFirst({ where: { shiftId, volunteerId: volunteer.id } });
      if (existing && existing.status !== 'CANCELLED') return existing;
      const status = taken < s.maxVolunteers ? ('REGISTERED' as const) : ('WAITLISTED' as const);
      const a = existing ? await tx.shiftAssignment.update({ where: { id: existing.id }, data: { status } }) : await tx.shiftAssignment.create({ data: { tenantId, shiftId, volunteerId: volunteer.id, status } });
      if (status === 'REGISTERED') {
        if (taken + 1 >= s.maxVolunteers) await tx.shift.update({ where: { id: s.id }, data: { status: 'FULL' } });
        await this.notify.send({ template: 'shift.assigned', to: volunteer.email, userId: volunteer.userId, tx: tx as never, vars: { name: volunteer.firstName, title: s.title, when: when(s.startDateTime, s.timezone), where: s.location ?? '-' } });
      }
      return a;
    });
  }
  private async remind() {
    const soon = await this.prisma.shiftAssignment.findMany({ where: { status: { in: ['REGISTERED', 'CONFIRMED'] }, shift: { startDateTime: { gt: new Date(), lt: new Date(Date.now() + 24 * 3600_000) }, status: { in: ['PUBLISHED', 'FULL'] } }, NOT: { metadata: { path: ['reminded'], equals: true } } }, include: { shift: true, volunteer: true }, take: 500 });
    for (const a of soon) {
      const t = await this.tenants.byId(a.tenantId);
      if (!t) continue;
      await runAsTenant(t, async () => {
        const { count } = await this.prisma.shiftAssignment.updateMany({ where: { id: a.id, OR: [{ metadata: { equals: Prisma.DbNull } }, { NOT: { metadata: { path: ['reminded'], equals: true } } }] }, data: { metadata: { reminded: true } } });
        if (count) await this.notify.send({ template: 'shift.reminder', to: a.volunteer.email, userId: a.volunteer.userId, vars: { name: a.volunteer.firstName, title: a.shift.title, when: when(a.shift.startDateTime, a.shift.timezone), where: a.shift.location ?? '-' } });
      });
    }
  }

  // ----- volunteer's own portal -----
  @Get('me') @SelfService()
  async mine() {
    const v = await this.prisma.volunteer.findFirst({ where: { userId: requireUser().id, deletedAt: null }, omit: { notes: true, tags: true, metadata: true }, include: { availabilities: { where: { deletedAt: null } }, volunteerSkills: { include: { skill: true } }, certificates: { where: { revokedAt: null } }, hoursLogs: { where: { deletedAt: null }, orderBy: { date: 'desc' }, take: 50 }, shiftAssignments: { orderBy: { createdAt: 'desc' }, take: 50, include: { shift: true } } } });
    return { profile: v };
  }
  @Put('me') @SelfService()
  async save(@ZBody(Profile) b: z.infer<typeof Profile>) {
    const u = requireUser();
    if (!u.emailVerified) throw new BadRequestException('Confirm your email first');
    const data = { ...b, address: b.address ?? undefined, emergencyContact: b.emergencyContact ?? undefined };
    const own = await this.prisma.volunteer.findFirst({ where: { OR: [{ userId: u.id }, { email: u.email, userId: null }], deletedAt: null } });
    if (own) return this.prisma.volunteer.update({ where: { id: own.id }, data: { ...data, userId: u.id }, select: { id: true, status: true } });
    const v = await this.prisma.volunteer.create({ data: { ...data, tenantId: requireTenant().id, userId: u.id, email: u.email, status: 'PENDING', source: 'website' }, select: { id: true, status: true } });
    await this.audit.log('CREATE', 'volunteer', v.id);
    return v;
  }
  @Put('me/availability') @SelfService()
  async availability(@ZBody(AvailIn) b: z.infer<typeof AvailIn>) {
    const v = await this.me();
    if (b.slots.some((s) => s.endTime <= s.startTime)) throw new BadRequestException('End time must be after start time');
    await this.prisma.$transaction(async (tx) => {
      await tx.availability.deleteMany({ where: { volunteerId: v.id } });
      await tx.availability.createMany({ data: b.slots.map((s) => ({ ...s, volunteerId: v.id, tenantId: requireTenant().id })) });
    });
    return { ok: true };
  }
  @Get('shifts') @SelfService()
  async open(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.ShiftWhereInput = { status: { in: ['PUBLISHED', 'FULL'] }, deletedAt: null, endDateTime: { gt: new Date() } };
    const [items, total] = await Promise.all([this.prisma.shift.findMany({ where, orderBy: { startDateTime: 'asc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { metadata: true, tags: true }, include: { _count: { select: { assignments: { where: { status: { in: SEATED } } } } } } }), this.prisma.shift.count({ where })]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Post('shifts/:id/join') @SelfService() @HttpCode(200)
  async join(@Param('id') id: string) {
    const v = await this.me();
    if (v.status !== 'ACTIVE') throw new BadRequestException({ code: 'NOT_APPROVED', message: 'Your volunteer application is not approved yet' });
    const a = await this.seat(id, v, false);
    return { id: a.id, status: a.status };
  }
  @Post('shifts/:id/leave') @SelfService() @HttpCode(200)
  async leave(@Param('id') id: string) {
    const v = await this.me();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shifts WHERE id = ${id} AND "tenantId" = ${requireTenant().id} FOR UPDATE`;
      const { count } = await tx.shiftAssignment.updateMany({ where: { shiftId: id, volunteerId: v.id, status: { in: ['REGISTERED', 'CONFIRMED', 'WAITLISTED'] }, shift: { startDateTime: { gt: new Date() } } }, data: { status: 'CANCELLED' } });
      if (!count) throw new BadRequestException('You cannot leave this shift');
      const next = await tx.shiftAssignment.findFirst({ where: { shiftId: id, status: 'WAITLISTED' }, orderBy: { updatedAt: 'asc' } });
      const s = await tx.shift.findFirstOrThrow({ where: { id } });
      if ((await tx.shiftAssignment.count({ where: { shiftId: id, status: { in: SEATED } } })) < s.maxVolunteers) {
        if (next) {
          await tx.shiftAssignment.update({ where: { id: next.id }, data: { status: 'REGISTERED' } });
          const nv = await tx.volunteer.findFirstOrThrow({ where: { id: next.volunteerId } });
          await this.notify.send({ template: 'shift.assigned', to: nv.email, userId: nv.userId, tx: tx as never, vars: { name: nv.firstName, title: s.title, when: when(s.startDateTime, s.timezone), where: s.location ?? '-' } });
        } else await tx.shift.updateMany({ where: { id, status: 'FULL' }, data: { status: 'PUBLISHED' } });
      }
    });
    return { ok: true };
  }
  @Post('me/hours') @SelfService()
  async logHours(@ZBody(HoursIn.omit({ volunteerId: true })) b: Omit<z.infer<typeof HoursIn>, 'volunteerId'>) {
    const v = await this.me();
    if (b.date > new Date()) throw new BadRequestException('The date is in the future');
    return this.prisma.hoursLog.create({ data: { ...b, volunteerId: v.id, tenantId: requireTenant().id }, select: { id: true, status: true } });
  }

  // ----- staff -----
  @Put(':id/decision') @Can('volunteers:update')
  async decide(@Param('id') id: string, @ZBody(Decision) b: z.infer<typeof Decision>) {
    const v = await this.prisma.volunteer.findFirst({ where: { id, deletedAt: null } });
    if (!v) throw new NotFoundException('Volunteer not found');
    await this.prisma.volunteer.update({ where: { id }, data: { status: b.status, ...(b.status === 'ACTIVE' && !v.joinDate ? { joinDate: new Date() } : {}) } });
    await this.audit.log('APPROVE', 'volunteer', id, { status: v.status }, b);
    const t = requireTenant();
    if (v.status === 'PENDING' && b.status === 'ACTIVE') await this.notify.send({ template: 'volunteer.welcome', to: v.email, userId: v.userId, vars: { name: v.firstName, link: `${this.tenants.url(t)}/${t.defaultLocale}/account/volunteering` } });
    return { ok: true };
  }
  @Put(':id/skills') @Can('volunteers:update')
  async skill(@Param('id') id: string, @ZBody(SkillIn) b: z.infer<typeof SkillIn>) {
    if (!(await this.prisma.volunteer.findFirst({ where: { id } })) || !(await this.prisma.skill.findFirst({ where: { id: b.skillId } }))) throw new NotFoundException('Not found');
    await this.prisma.volunteerSkill.upsert({ where: { volunteerId_skillId: { volunteerId: id, skillId: b.skillId } }, update: { proficiency: b.proficiency, verifiedBy: requireUser().id, verifiedAt: new Date() }, create: { volunteerId: id, skillId: b.skillId, proficiency: b.proficiency, verifiedBy: requireUser().id, verifiedAt: new Date() } });
    return { ok: true };
  }
  @Get('shifts/:id/roster') @Can('shifts:read')
  async roster(@Param('id') id: string) {
    return { items: await this.prisma.shiftAssignment.findMany({ where: { shiftId: id }, orderBy: { createdAt: 'asc' }, include: { volunteer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } }) };
  }
  @Post('shifts/:id/assign') @Can('shifts:update') @HttpCode(200)
  async assign(@Param('id') id: string, @ZBody(Assign) b: { volunteerId: string }) {
    const v = await this.prisma.volunteer.findFirst({ where: { id: b.volunteerId, status: 'ACTIVE', deletedAt: null } });
    if (!v) throw new NotFoundException('Volunteer not found');
    return this.seat(id, v, true);
  }
  @Post('assignments/:id/check-in') @Can('shifts:update') @HttpCode(200)
  async checkIn(@Param('id') id: string) {
    const { count } = await this.prisma.shiftAssignment.updateMany({ where: { id, status: { in: ['REGISTERED', 'CONFIRMED'] }, checkInTime: null }, data: { checkInTime: new Date(), status: 'CONFIRMED' } });
    if (!count) throw new BadRequestException('Cannot check in');
    return { ok: true };
  }
  @Post('assignments/:id/check-out') @Can('shifts:update') @HttpCode(200)
  async checkOut(@Param('id') id: string) {
    const out = new Date();
    await this.prisma.$transaction(async (tx) => {
      const a = await tx.shiftAssignment.findFirst({ where: { id, checkInTime: { not: null }, checkOutTime: null }, include: { shift: true } });
      if (!a) throw new BadRequestException('Check in first');
      // Credit is capped at the shift length so a forgotten check-out cannot inflate hours.
      const ms = Math.min(out.getTime() - a.checkInTime!.getTime(), a.shift.endDateTime.getTime() - a.shift.startDateTime.getTime());
      const hours = Math.max(0.25, Math.round((ms / 3600_000) * 4) / 4);
      const { count } = await tx.shiftAssignment.updateMany({ where: { id, checkOutTime: null }, data: { checkOutTime: out, status: 'ATTENDED', hoursCredited: hours } });
      if (!count) return;
      await tx.hoursLog.create({ data: { tenantId: a.tenantId, volunteerId: a.volunteerId, shiftId: a.shiftId, date: a.checkInTime!, hours, status: 'APPROVED', verifiedBy: requireUser().id, verifiedAt: out, description: a.shift.title } });
      await tx.volunteer.update({ where: { id: a.volunteerId }, data: { totalHours: { increment: hours }, totalShifts: { increment: 1 } } });
    });
    return { ok: true };
  }
  @Get('hours') @Can('hours:read')
  async hours(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.HoursLogWhereInput = { deletedAt: null };
    const [items, total] = await Promise.all([this.prisma.hoursLog.findMany({ where, orderBy: [{ status: 'asc' }, { date: 'desc' }], skip: (p.page - 1) * p.limit, take: p.limit, include: { volunteer: { select: { firstName: true, lastName: true } } } }), this.prisma.hoursLog.count({ where })]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Put('hours/:id') @Can('hours:manage')
  async decideHours(@Param('id') id: string, @ZBody(HoursDecision) b: z.infer<typeof HoursDecision>) {
    await this.prisma.$transaction(async (tx) => {
      const h = await tx.hoursLog.findFirst({ where: { id } });
      const { count } = await tx.hoursLog.updateMany({ where: { id, status: 'PENDING' }, data: { status: b.status, verifiedBy: requireUser().id, verifiedAt: new Date() } });
      if (!h || !count) throw new BadRequestException('Already decided');
      if (b.status === 'APPROVED') await tx.volunteer.update({ where: { id: h.volunteerId }, data: { totalHours: { increment: h.hours } } });
    });
    await this.audit.log('APPROVE', 'hoursLog', id, undefined, b);
    return { ok: true };
  }
  @Post('certificates') @Can('certificates:create')
  async certify(@ZBody(CertIn) b: z.infer<typeof CertIn>) {
    const v = await this.prisma.volunteer.findFirst({ where: { id: b.volunteerId } });
    if (!v) throw new NotFoundException('Volunteer not found');
    return this.prisma.certificate.create({ data: { tenantId: requireTenant().id, volunteerId: v.id, title: b.title, hours: v.totalHours, code: randomToken(9).toUpperCase().replace(/[^A-Z0-9]/g, '7') } });
  }
  /** Anyone holding the code can check that a certificate is real. */
  @Get('certificates/:code/verify') @Public()
  async verify(@Param('code') code: string) {
    const c = await this.prisma.certificate.findFirst({ where: { code }, include: { volunteer: { select: { firstName: true, lastName: true } } } });
    if (!c) throw new NotFoundException('No certificate has this code');
    return { valid: !c.revokedAt, title: c.title, hours: Number(c.hours), issuedAt: c.issuedAt, name: `${c.volunteer.firstName} ${c.volunteer.lastName}`, organisation: requireTenant().displayName ?? requireTenant().name };
  }
  @Get('certificates/:code/pdf') @Public()
  async pdf(@Param('code') code: string, @Res() res: Response) {
    const c = await this.prisma.certificate.findFirst({ where: { code, revokedAt: null }, include: { volunteer: true } });
    if (!c) throw new NotFoundException('No certificate has this code');
    const t = requireTenant();
    const pdf = await TextPdf.create({ size: 'A4', layout: 'landscape', margin: 60, info: { Title: c.title, Author: t.displayName ?? t.name } });
    const { doc } = pdf;
    const mid = (text: string, size: number, color: string, gap: number, bold = false) => pdf.text(text, { size, color, gap, bold, align: 'center' });
    doc.lineWidth(2).rect(30, 30, 782, 535).stroke('#2f6b4a');
    doc.y = 130;
    mid(t.displayName ?? t.name, 16, '#2f6b4a', 28);
    mid(c.title, 32, '#111', 18, true);
    mid('Presented to', 14, '#111', 6);
    mid(`${c.volunteer.firstName} ${c.volunteer.lastName}`, 26, '#111', 14);
    mid(`for ${Number(c.hours)} hours of volunteer service`, 14, '#111', 36);
    mid(`Issued ${c.issuedAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}. Verify at ${this.tenants.url(t)}/${t.defaultLocale}/verify/${c.code}`, 10, '#555', 0);
    const body = await pdf.buffer();
    res.setHeader('content-type', 'application/pdf').setHeader('content-disposition', `attachment; filename="certificate-${c.code}.pdf"`).send(body);
  }
}
@Module({ controllers: [VolunteeringController, Volunteers, Shifts, Skills] })
export class VolunteersModule {}
