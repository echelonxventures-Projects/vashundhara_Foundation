import { BadRequestException, Controller, Get, HttpCode, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Gender, LocaleCode, Prisma, PublishStatus, StudentStatus } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { crudController } from '../../common/crud/crud';
import { Can, PageQuery, Paging, Public, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { PrismaService } from '../../common/prisma/prisma.module';
import { Slug } from '../auth/auth.module';
import { FilesService } from '../files/files.module';
import { NotificationsService } from '../notifications/notifications.module';

const id = z.string().max(60);
const text = (n: number) => z.string().trim().min(1).max(n);
const opt = (n: number) => z.string().trim().max(n).nullish();
const https = z.url({ protocol: /^https$/ }).max(500);
const age = (dob: Date) => (Date.now() - dob.getTime()) / (365.25 * 86400_000);

const StudentBase = z.object({ fullName: text(120), phone: opt(20), guardianName: opt(120), guardianPhone: opt(20), dateOfBirth: z.coerce.date().nullish(), gender: z.enum(Gender).nullish(), grade: opt(40), school: opt(150) });
const Students = crudController({
  path: 'students', resource: 'students', model: 'student', search: ['fullName', 'email', 'school'], filters: ['status', 'grade'], sort: ['fullName'],
  schema: StudentBase.extend({ email: z.email().nullish(), guardianConsentAt: z.coerce.date().nullish(), status: z.enum(StudentStatus).optional(), notes: opt(2000) }),
  prepare: (d, { existing }) => {
    const dob = d.dateOfBirth ?? existing?.dateOfBirth;
    const status = d.status ?? existing?.status;
    if (status === 'ACTIVE' && dob && age(new Date(dob)) < 18 && !(d.guardianConsentAt ?? existing?.guardianConsentAt)) throw new BadRequestException({ code: 'GUARDIAN_CONSENT', message: "A guardian's consent is needed for students under 18" });
    return d;
  }
});
const teacher = async (d: Record<string, any>, prisma: PrismaService) => {
  if (d.teacherId && !(await prisma.membership.findFirst({ where: { userId: d.teacherId } }))) throw new BadRequestException('The teacher must be a member');
  return d;
};
const Courses = crudController({ path: 'courses', resource: 'courses', model: 'course', search: ['title'], filters: ['status', 'language'], include: { _count: { select: { lessons: true, enrolments: true } } }, schema: z.object({ slug: Slug, title: text(150), summary: opt(300), description: opt(10_000), level: opt(40), language: z.enum(LocaleCode).optional(), teacherId: id.nullish(), status: z.enum(PublishStatus).optional() }), prepare: (d, { prisma }) => teacher(d, prisma) });
const Lessons = crudController({ path: 'lessons', resource: 'courses', model: 'lesson', filters: ['courseId', 'status'], sort: ['order'], defaultSort: { order: 'asc' }, schema: z.object({ courseId: id, title: text(150), body: opt(50_000), videoUrl: https.nullish(), fileId: id.nullish(), order: z.number().int().min(0).max(1000).optional(), status: z.enum(PublishStatus).optional() }) });
const LiveClasses = crudController({
  path: 'live-classes', resource: 'courses', model: 'liveClass', filters: ['courseId'], sort: ['startsAt'], include: { course: { select: { title: true } } },
  schema: z.object({ courseId: id, title: text(150), meetingUrl: https, startsAt: z.coerce.date(), endsAt: z.coerce.date(), recordingUrl: https.nullish() }),
  prepare: (d, { existing }) => { if (new Date(d.endsAt ?? existing?.endsAt) <= new Date(d.startsAt ?? existing?.startsAt)) throw new BadRequestException('The class must end after it starts'); return d; }
});
const Assignments = crudController({ path: 'assignments', resource: 'courses', model: 'assignment', search: ['title'], filters: ['courseId', 'status'], sort: ['dueAt'], include: { course: { select: { title: true } }, _count: { select: { submissions: true } } }, schema: z.object({ courseId: id, title: text(150), instructions: text(10_000), maxScore: z.number().int().min(1).max(1000).optional(), dueAt: z.coerce.date().nullish(), fileId: id.nullish(), status: z.enum(PublishStatus).optional() }) });
const Enrolments = crudController({ path: 'enrolments', resource: 'students', model: 'enrolment', filters: ['courseId', 'studentId', 'status'], include: { student: { select: { fullName: true } }, course: { select: { title: true } }, _count: { select: { progress: true } } }, schema: z.object({ courseId: id, studentId: id }), only: ['list', 'create', 'delete'] });
const Library = crudController({ path: 'library', resource: 'library', model: 'libraryItem', search: ['title', 'author'], filters: ['status', 'category', 'language', 'tags'], sort: ['title'], include: { _count: { select: { accesses: true } } }, schema: z.object({ title: text(200), author: opt(150), description: opt(3000), category: opt(60), language: z.enum(LocaleCode).optional(), tags: z.array(z.string().max(30)).max(20).optional(), fileId: id.nullish(), externalUrl: https.nullish(), isPublic: z.boolean().optional(), status: z.enum(PublishStatus).optional() }) });

const Apply = StudentBase.extend({ guardianConsent: z.boolean().optional() });
const Submit = z.object({ text: opt(20_000), fileId: id.nullish() }).refine((v) => v.text || v.fileId, 'Write an answer or attach a file');
const Grade = z.object({ score: z.number().int().min(0).max(1000), feedback: opt(3000) });
const Attendance = z.object({ records: z.array(z.object({ studentId: id, present: z.boolean() })).min(1).max(500) });

@ApiTags('learning')
@Controller('learning')
export class LearningController {
  constructor(private readonly prisma: PrismaService, private readonly files: FilesService, private readonly notify: NotificationsService, private readonly audit: AuditService) {}

  private async student() {
    const s = await this.prisma.student.findFirst({ where: { userId: requireUser().id, deletedAt: null } });
    if (!s) throw new NotFoundException({ code: 'NO_PROFILE', message: 'Complete your student profile first' });
    return s;
  }
  private async enrolment(courseId: string) {
    const s = await this.student();
    const e = await this.prisma.enrolment.findFirst({ where: { courseId, studentId: s.id, status: { not: 'WITHDRAWN' }, course: { status: 'PUBLISHED', deletedAt: null } } });
    if (!e) throw new NotFoundException('You are not enrolled in this course');
    return { s, e };
  }

  @Get('courses') @Public()
  async catalogue(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.CourseWhereInput = { status: 'PUBLISHED', deletedAt: null, ...(p.q ? { title: { contains: p.q, mode: 'insensitive' } } : {}) };
    const [items, total] = await Promise.all([this.prisma.course.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, select: { id: true, slug: true, title: true, summary: true, level: true, language: true, _count: { select: { lessons: { where: { status: 'PUBLISHED', deletedAt: null } } } } } }), this.prisma.course.count({ where })]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get('me') @SelfService()
  async me() {
    const s = await this.prisma.student.findFirst({ where: { userId: requireUser().id, deletedAt: null }, omit: { notes: true } });
    if (!s) return { student: null, enrolments: [] };
    const enrolments = await this.prisma.enrolment.findMany({ where: { studentId: s.id, status: { not: 'WITHDRAWN' } }, include: { course: { select: { id: true, title: true, slug: true, _count: { select: { lessons: { where: { status: 'PUBLISHED', deletedAt: null } } } } } }, _count: { select: { progress: { where: { completedAt: { not: null } } } } } } });
    return { student: s, enrolments: enrolments.map((e) => ({ id: e.id, status: e.status, course: e.course, done: e._count.progress, lessons: e.course._count.lessons })) };
  }
  @Put('me') @SelfService()
  async saveMe(@ZBody(Apply) b: z.infer<typeof Apply>) {
    const u = requireUser();
    const { guardianConsent, ...data } = b;
    const minor = !b.dateOfBirth || age(b.dateOfBirth) < 18;
    if (minor && !(guardianConsent && b.guardianName && b.guardianPhone)) throw new BadRequestException({ code: 'GUARDIAN_CONSENT', message: "Students under 18 need a guardian's name, phone and consent" });
    const own = await this.prisma.student.findFirst({ where: { userId: u.id, deletedAt: null } });
    const consent = minor ? { guardianConsentAt: own?.guardianConsentAt ?? new Date() } : {};
    if (own) return this.prisma.student.update({ where: { id: own.id }, data: { ...data, ...consent }, select: { id: true, status: true } });
    const s = await this.prisma.student.create({ data: { ...data, ...consent, userId: u.id, email: u.email, tenantId: requireTenant().id }, select: { id: true, status: true } });
    await this.prisma.consentRecord.create({ data: { tenantId: requireTenant().id, userId: u.id, email: u.email, purpose: minor ? 'student_guardian' : 'student', version: '1', granted: true, ipAddress: getCtx()?.ip } });
    return s;
  }
  @Post('courses/:id/enrol') @SelfService() @HttpCode(200)
  async enrol(@Param('id') courseId: string) {
    const s = await this.student();
    if (s.status !== 'ACTIVE') throw new BadRequestException({ code: 'NOT_APPROVED', message: 'Your student application is not approved yet' });
    const c = await this.prisma.course.findFirst({ where: { id: courseId, status: 'PUBLISHED', deletedAt: null } });
    if (!c) throw new NotFoundException('Course not found');
    const e = await this.prisma.enrolment.findFirst({ where: { courseId, studentId: s.id } });
    if (e) return this.prisma.enrolment.update({ where: { id: e.id }, data: { status: e.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE' } });
    return this.prisma.enrolment.create({ data: { courseId, studentId: s.id, tenantId: requireTenant().id } });
  }
  @Get('courses/:id') @SelfService()
  async course(@Param('id') courseId: string) {
    const { s, e } = await this.enrolment(courseId);
    const published = { status: 'PUBLISHED' as const, deletedAt: null };
    const [course, lessons, classes, assignments, progress] = await Promise.all([
      this.prisma.course.findFirst({ where: { id: courseId }, select: { id: true, title: true, description: true } }),
      this.prisma.lesson.findMany({ where: { courseId, ...published }, orderBy: { order: 'asc' } }),
      this.prisma.liveClass.findMany({ where: { courseId, deletedAt: null }, orderBy: { startsAt: 'asc' } }),
      this.prisma.assignment.findMany({ where: { courseId, ...published }, orderBy: { dueAt: 'asc' }, include: { submissions: { where: { studentId: s.id } } } }),
      this.prisma.lessonProgress.findMany({ where: { enrolmentId: e.id, completedAt: { not: null } }, select: { lessonId: true } })
    ]);
    const done = new Set(progress.map((p) => p.lessonId));
    const now = Date.now();
    return {
      course, lessons: lessons.map((l) => ({ ...l, done: done.has(l.id) })),
      classes: classes.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt, endsAt: c.endsAt, recordingUrl: c.recordingUrl, joinable: now > c.startsAt.getTime() - 900_000 && now < c.endsAt.getTime() })),
      assignments: assignments.map(({ submissions, ...a }) => ({ ...a, submission: submissions[0] ?? null }))
    };
  }
  @Post('lessons/:id/complete') @SelfService() @HttpCode(200)
  async complete(@Param('id') lessonId: string) {
    const l = await this.prisma.lesson.findFirst({ where: { id: lessonId, status: 'PUBLISHED', deletedAt: null } });
    if (!l) throw new NotFoundException('Lesson not found');
    const { e } = await this.enrolment(l.courseId);
    await this.prisma.lessonProgress.createMany({ data: [{ tenantId: e.tenantId, enrolmentId: e.id, lessonId, completedAt: new Date() }], skipDuplicates: true });
    const [done, total] = await Promise.all([this.prisma.lessonProgress.count({ where: { enrolmentId: e.id, lesson: { status: 'PUBLISHED', deletedAt: null } } }), this.prisma.lesson.count({ where: { courseId: l.courseId, status: 'PUBLISHED', deletedAt: null } })]);
    if (done >= total) await this.prisma.enrolment.updateMany({ where: { id: e.id, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt: new Date() } });
    return { done, total };
  }
  /** Records attendance, then hands over the meeting link. */
  @Post('classes/:id/join') @SelfService() @HttpCode(200)
  async join(@Param('id') cid: string) {
    const c = await this.prisma.liveClass.findFirst({ where: { id: cid, deletedAt: null } });
    if (!c) throw new NotFoundException('Class not found');
    const { s } = await this.enrolment(c.courseId);
    if (Date.now() < c.startsAt.getTime() - 900_000 || Date.now() > c.endsAt.getTime()) throw new BadRequestException({ code: 'NOT_OPEN', message: 'The class opens 15 minutes before it starts' });
    await this.prisma.classAttendance.createMany({ data: [{ tenantId: c.tenantId, liveClassId: c.id, studentId: s.id, joinedAt: new Date() }], skipDuplicates: true });
    return { url: c.meetingUrl };
  }
  @Post('assignments/:id/submit') @SelfService() @HttpCode(200)
  async submit(@Param('id') aid: string, @ZBody(Submit) b: z.infer<typeof Submit>) {
    const a = await this.prisma.assignment.findFirst({ where: { id: aid, status: 'PUBLISHED', deletedAt: null } });
    if (!a) throw new NotFoundException('Assignment not found');
    const { s } = await this.enrolment(a.courseId);
    if (b.fileId && !(await this.prisma.file.findFirst({ where: { id: b.fileId, uploadedById: requireUser().id } }))) throw new BadRequestException('Upload your own file first');
    const isLate = Boolean(a.dueAt && a.dueAt < new Date());
    const old = await this.prisma.submission.findFirst({ where: { assignmentId: aid, studentId: s.id } });
    if (old?.status === 'GRADED') throw new BadRequestException('This work has already been marked');
    const data = { text: b.text, fileId: b.fileId, isLate, status: 'SUBMITTED' as const, submittedAt: new Date() };
    return old ? this.prisma.submission.update({ where: { id: old.id }, data }) : this.prisma.submission.create({ data: { ...data, tenantId: a.tenantId, assignmentId: aid, studentId: s.id } });
  }

  // ----- teachers -----
  @Get('assignments/:id/submissions') @Can('grading:read')
  async submissions(@Param('id') aid: string) { return { items: await this.prisma.submission.findMany({ where: { assignmentId: aid }, orderBy: { submittedAt: 'asc' }, include: { student: { select: { fullName: true } } } }) }; }
  @Put('submissions/:id/grade') @Can('grading:update')
  async grade(@Param('id') sid: string, @ZBody(Grade) b: z.infer<typeof Grade>) {
    const sub = await this.prisma.submission.findFirst({ where: { id: sid }, include: { assignment: true, student: true } });
    if (!sub) throw new NotFoundException('Submission not found');
    if (b.score > sub.assignment.maxScore) throw new BadRequestException(`The highest mark is ${sub.assignment.maxScore}`);
    await this.prisma.submission.update({ where: { id: sid }, data: { ...b, status: 'GRADED', gradedById: requireUser().id, gradedAt: new Date() } });
    await this.audit.log('UPDATE', 'submission', sid, { score: sub.score }, { score: b.score });
    if (sub.student.email) await this.notify.send({ template: 'assignment.graded', to: sub.student.email, userId: sub.student.userId, vars: { name: sub.student.fullName, title: sub.assignment.title, score: `${b.score}/${sub.assignment.maxScore}`, feedback: b.feedback ?? '' } });
    return { ok: true };
  }
  @Put('classes/:id/attendance') @Can('courses:update')
  async attendance(@Param('id') cid: string, @ZBody(Attendance) b: z.infer<typeof Attendance>) {
    const c = await this.prisma.liveClass.findFirst({ where: { id: cid } });
    if (!c) throw new NotFoundException('Class not found');
    const enrolled = new Set((await this.prisma.enrolment.findMany({ where: { courseId: c.courseId, studentId: { in: b.records.map((r) => r.studentId) } }, select: { studentId: true } })).map((e) => e.studentId));
    for (const r of b.records.filter((x) => enrolled.has(x.studentId))) {
      const old = await this.prisma.classAttendance.findFirst({ where: { liveClassId: cid, studentId: r.studentId } });
      if (old) await this.prisma.classAttendance.update({ where: { id: old.id }, data: { present: r.present } });
      else await this.prisma.classAttendance.create({ data: { tenantId: c.tenantId, liveClassId: cid, ...r } });
    }
    return { saved: enrolled.size };
  }
  @Get('courses/:id/gradebook') @Can('grading:read')
  async gradebook(@Param('id') courseId: string) {
    const [enrolments, assignments, classes] = await Promise.all([
      this.prisma.enrolment.findMany({ where: { courseId, status: { not: 'WITHDRAWN' } }, include: { student: { select: { id: true, fullName: true, submissions: { where: { assignment: { courseId } }, select: { assignmentId: true, score: true, status: true, isLate: true } }, attendance: { where: { present: true, liveClass: { courseId } }, select: { id: true } } } }, _count: { select: { progress: true } } } }),
      this.prisma.assignment.findMany({ where: { courseId, deletedAt: null }, select: { id: true, title: true, maxScore: true } }), this.prisma.liveClass.count({ where: { courseId, deletedAt: null, startsAt: { lt: new Date() } } })
    ]);
    return { assignments, classes, items: enrolments.map((e) => ({ studentId: e.student.id, name: e.student.fullName, lessonsDone: e._count.progress, attended: e.student.attendance.length, submissions: e.student.submissions })) };
  }

  // ----- digital library -----
  private libraryWhere(): Prisma.LibraryItemWhereInput { return { status: 'PUBLISHED', deletedAt: null, ...(getCtx()?.user ? {} : { isPublic: true }) }; }
  @Get('library') @Public()
  async library(@ZQuery(PageQuery.extend({ category: z.string().max(60).optional() })) p: Paging & { category?: string }) {
    const where: Prisma.LibraryItemWhereInput = { ...this.libraryWhere(), ...(p.category ? { category: p.category } : {}), ...(p.q ? { OR: [{ title: { contains: p.q, mode: 'insensitive' } }, { author: { contains: p.q, mode: 'insensitive' } }, { tags: { has: p.q } }] } : {}) };
    const [items, total, cats] = await Promise.all([this.prisma.libraryItem.findMany({ where, orderBy: { title: 'asc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { fileId: true, externalUrl: true } }), this.prisma.libraryItem.count({ where }), this.prisma.libraryItem.groupBy({ by: ['category'], where: this.libraryWhere() })]);
    return { items, total, page: p.page, limit: p.limit, categories: cats.map((c) => c.category).filter(Boolean) };
  }
  @Post('library/:id/open') @Public() @HttpCode(200)
  async open(@Param('id') iid: string) {
    const i = await this.prisma.libraryItem.findFirst({ where: { id: iid, ...this.libraryWhere() } });
    if (!i) throw new NotFoundException('Not found');
    const f = i.fileId ? await this.prisma.file.findFirst({ where: { id: i.fileId, deletedAt: null } }) : null;
    const url = f ? await this.files.url(f) : i.externalUrl;
    if (!url) throw new NotFoundException('Nothing to open yet');
    await this.prisma.libraryAccess.create({ data: { tenantId: i.tenantId, itemId: i.id, userId: getCtx()?.user?.id } });
    return { url };
  }
}
@Module({ controllers: [LearningController, Students, Courses, Lessons, LiveClasses, Assignments, Enrolments, Library] })
export class LearningModule {}
