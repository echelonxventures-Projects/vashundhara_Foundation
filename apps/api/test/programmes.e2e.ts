import { randomUUID } from 'crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, boot, clearLimits, db, login, ngo, person, shutdown } from './helpers';

type Call = ReturnType<typeof as>;
let alpha: { id: string };
let beta: { id: string };
let admin: Call;
const inH = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const user = async (email: string, roles: string[]): Promise<Call> => { await person(email, alpha.id, roles); return as('alpha', await login(email, 'alpha')); };
beforeAll(async () => {
  await boot();
  alpha = await ngo('alpha');
  beta = await ngo('beta');
  admin = await user('admin@alpha.org', ['tenant_admin']);
});
afterAll(shutdown);
beforeEach(clearLimits);

describe('CRM', () => {
  it('runs a deal through a pipeline and keeps stages consistent', async () => {
    const p1 = (await admin('post', 'crm/pipelines', { name: 'P1', stages: [{ name: 'New', probability: 10 }, { name: 'Won', probability: 100 }] })).body;
    const p2 = (await admin('post', 'crm/pipelines', { name: 'P2', stages: [{ name: 'Other', probability: 10 }] })).body;
    const full = (await admin('get', `crm/pipelines/${p1.id}`)).body;
    const c = (await admin('post', 'crm/contacts', { firstName: 'Ravi', lastName: 'K', email: 'ravi@x.org' })).body;
    const deal = await admin('post', 'crm/deals', { title: 'CSR', value: 100000, pipelineId: p1.id, stageId: full.pipelineStages[0].id, contactId: c.id });
    expect(deal.status).toBe(201);
    expect((await admin('post', 'crm/deals', { title: 'Bad', value: 1, pipelineId: p2.id, stageId: full.pipelineStages[0].id })).status).toBe(400);
    expect((await admin('post', 'crm/activities', { type: 'CALL', subject: 'Hello', contactId: c.id })).status).toBe(201);
    expect((await db.contact.findUniqueOrThrow({ where: { id: c.id } })).lastContactedAt).not.toBeNull();
    expect((await admin('post', 'crm/contacts', { firstName: 'R', lastName: 'K', email: 'ravi@x.org' })).status).toBe(409);
    expect((await admin('get', 'crm/dashboard')).body.deals).toBe(1);
  });
  it('a partial update leaves other fields alone', async () => {
    const c = (await admin('post', 'crm/contacts', { firstName: 'A', lastName: 'B', leadScore: 70, tags: ['x'] })).body;
    const u = (await admin('put', `crm/contacts/${c.id}`, { firstName: 'Z' })).body;
    expect([u.firstName, u.leadScore, u.tags]).toEqual(['Z', 70, ['x']]);
  });
});

describe('volunteers', () => {
  it('approval, last place, waitlist, hours and certificate', async () => {
    const calls: Call[] = [];
    for (const i of [1, 2]) {
      const v = await user(`vol${i}@alpha.org`, ['volunteer']);
      expect((await v('put', 'volunteering/me', { firstName: `Vol${i}`, lastName: 'X' })).status).toBe(200);
      calls.push(v);
    }
    const shift = (await admin('post', 'shifts', { title: 'Plant trees', startDateTime: inH(24), endDateTime: inH(27), maxVolunteers: 1, status: 'PUBLISHED' })).body;
    expect((await calls[0]('post', `volunteering/shifts/${shift.id}/join`)).body.error.code).toBe('NOT_APPROVED');
    const vols = (await admin('get', 'volunteers?sort=lastName')).body.items as { id: string; email: string }[];
    for (const v of vols) expect((await admin('put', `volunteering/${v.id}/decision`, { status: 'ACTIVE' })).status).toBe(200);
    const rs = await Promise.all(calls.map((c) => c('post', `volunteering/shifts/${shift.id}/join`)));
    expect(rs.map((r) => r.body.status).sort()).toEqual(['REGISTERED', 'WAITLISTED']);
    const first = calls[rs.findIndex((r) => r.body.status === 'REGISTERED')];
    const second = calls[rs.findIndex((r) => r.body.status === 'WAITLISTED')];
    expect((await first('post', `volunteering/shifts/${shift.id}/leave`)).status).toBe(200);
    expect((await second('get', 'volunteering/me')).body.profile.shiftAssignments[0].status).toBe('REGISTERED');
    const clash = (await admin('post', 'shifts', { title: 'Clash', startDateTime: inH(25), endDateTime: inH(26), status: 'PUBLISHED' })).body;
    expect((await second('post', `volunteering/shifts/${clash.id}/join`)).body.error.code).toBe('CLASH');
    const a = (await admin('get', `volunteering/shifts/${shift.id}/roster`)).body.items.find((x: any) => x.status === 'REGISTERED');
    await admin('post', `volunteering/assignments/${a.id}/check-in`);
    await db.shiftAssignment.update({ where: { id: a.id }, data: { checkInTime: new Date(Date.now() - 50 * 3600_000) } });
    expect((await admin('post', `volunteering/assignments/${a.id}/check-out`)).status).toBe(200);
    expect((await admin('post', `volunteering/assignments/${a.id}/check-out`)).status).toBe(400);
    expect(Number((await db.volunteer.findUniqueOrThrow({ where: { id: a.volunteerId } })).totalHours)).toBe(3);
    const h = (await second('post', 'volunteering/me/hours', { date: new Date(), hours: 1.5 })).body;
    await admin('put', `volunteering/hours/${h.id}`, { status: 'APPROVED' });
    expect((await admin('put', `volunteering/hours/${h.id}`, { status: 'APPROVED' })).status).toBe(400);
    const cert = (await admin('post', 'volunteering/certificates', { volunteerId: a.volunteerId, title: 'Thank you' })).body;
    expect((await as('alpha')('get', `volunteering/certificates/${cert.code}/verify`)).body).toMatchObject({ valid: true, hours: 4.5 });
    expect((await as('beta')('get', `volunteering/certificates/${cert.code}/verify`)).status).toBe(404);
  });
});

describe('beneficiaries and field work', () => {
  it('needs consent, follows the approval path, and gates aid', async () => {
    const b = await user('needy@alpha.org', ['beneficiary']);
    expect((await b('post', 'beneficiary-services/apply', { fullName: 'Meena' })).status).toBe(422);
    const app = (await b('post', 'beneficiary-services/apply', { fullName: 'Meena', consent: true, need: 'School fees' })).body;
    const aid = { beneficiaryId: app.id, type: 'SCHOLARSHIP', description: 'Fees', valueMinor: 500000, givenAt: new Date() };
    expect((await admin('post', 'aid', aid)).status).toBe(400);
    expect((await admin('put', `beneficiary-services/${app.id}/decision`, { status: 'EXITED' })).status).toBe(400);
    expect((await admin('put', `beneficiary-services/${app.id}/decision`, { status: 'APPROVED' })).status).toBe(200);
    expect((await admin('post', 'aid', aid)).status).toBe(201);
    expect((await b('get', 'beneficiary-services/me')).body.items[0].aidRecords).toHaveLength(1);
    expect((await admin('post', 'beneficiaries', { fullName: 'No consent' })).status).toBe(400);
  });
  it('accepts an offline batch twice without duplicates and rejects foreign links', async () => {
    const w = await user('field@alpha.org', ['field_worker']);
    const foreign = await db.beneficiary.create({ data: { tenantId: beta.id, fullName: 'Beta person' } });
    const visits = [{ clientId: randomUUID(), purpose: 'Home visit', latitude: 12.9, longitude: 77.6, visitedAt: new Date() }, { clientId: randomUUID(), purpose: 'Bad', beneficiaryId: foreign.id, visitedAt: new Date() }];
    const body = { visits, attendance: [{ clientId: randomUUID(), kind: 'IN', recordedAt: new Date() }] };
    const r = (await w('post', 'field/sync', body)).body;
    expect(r.accepted).toHaveLength(2);
    expect(r.rejected).toHaveLength(1);
    await w('post', 'field/sync', body);
    expect(await db.fieldVisit.count()).toBe(1);
    expect((await w('get', 'donors')).status).toBe(403);
  });
});

describe('learning', () => {
  it('course, live class, assignment, marks and completion', async () => {
    const teacher = await user('teacher@alpha.org', ['teacher']);
    const s = await user('student@alpha.org', ['student']);
    expect((await s('put', 'learning/me', { fullName: 'Kiran', dateOfBirth: '2015-01-01' })).body.error.code).toBe('GUARDIAN_CONSENT');
    expect((await s('put', 'learning/me', { fullName: 'Kiran', dateOfBirth: '2015-01-01', guardianName: 'G', guardianPhone: '9999999999', guardianConsent: true })).status).toBe(200);
    const course = (await teacher('post', 'courses', { slug: 'maths-5', title: 'Maths', status: 'PUBLISHED' })).body;
    expect((await s('post', `learning/courses/${course.id}/enrol`)).body.error.code).toBe('NOT_APPROVED');
    const st = (await admin('get', 'students')).body.items[0];
    expect((await admin('put', `students/${st.id}`, { status: 'ACTIVE' })).status).toBe(200);
    expect((await s('get', `learning/courses/${course.id}`)).status).toBe(404);
    expect((await s('post', `learning/courses/${course.id}/enrol`)).status).toBe(200);
    const lesson = (await teacher('post', 'lessons', { courseId: course.id, title: 'L1', status: 'PUBLISHED' })).body;
    await teacher('post', 'lessons', { courseId: course.id, title: 'Draft' });
    const live = (await teacher('post', 'live-classes', { courseId: course.id, title: 'Live', meetingUrl: 'https://meet.example.org/x', startsAt: inH(2), endsAt: inH(3) })).body;
    const view = (await s('get', `learning/courses/${course.id}`)).body;
    expect(view.lessons).toHaveLength(1);
    expect(JSON.stringify(view)).not.toContain('meet.example.org');
    expect((await s('post', `learning/classes/${live.id}/join`)).body.error.code).toBe('NOT_OPEN');
    await db.liveClass.update({ where: { id: live.id }, data: { startsAt: new Date() } });
    expect((await s('post', `learning/classes/${live.id}/join`)).body.url).toContain('meet.example.org');
    const asg = (await teacher('post', 'assignments', { courseId: course.id, title: 'HW', instructions: 'Do it', maxScore: 10, dueAt: inH(-1), status: 'PUBLISHED' })).body;
    expect((await s('post', `learning/assignments/${asg.id}/submit`, {})).status).toBe(422);
    const sub = (await s('post', `learning/assignments/${asg.id}/submit`, { text: '42' })).body;
    expect(sub.isLate).toBe(true);
    expect((await s('put', `learning/submissions/${sub.id}/grade`, { score: 10 })).status).toBe(403);
    expect((await teacher('put', `learning/submissions/${sub.id}/grade`, { score: 11 })).status).toBe(400);
    expect((await teacher('put', `learning/submissions/${sub.id}/grade`, { score: 9, feedback: 'Good' })).status).toBe(200);
    expect((await s('post', `learning/assignments/${asg.id}/submit`, { text: 'again' })).status).toBe(400);
    expect((await s('post', `learning/lessons/${lesson.id}/complete`)).body).toEqual({ done: 1, total: 1 });
    expect((await db.enrolment.findFirstOrThrow()).status).toBe('COMPLETED');
    expect((await teacher('get', `learning/courses/${course.id}/gradebook`)).body.items[0]).toMatchObject({ attended: 1, lessonsDone: 1 });
  });
  it('library hides members-only and draft items', async () => {
    for (const x of [{ title: 'Open', isPublic: true, status: 'PUBLISHED' }, { title: 'Members', status: 'PUBLISHED' }, { title: 'Draft', isPublic: true }]) await admin('post', 'library', { ...x, externalUrl: 'https://x.org/a.pdf' });
    const pub = (await as('alpha')('get', 'learning/library')).body;
    expect(pub.items.map((i: any) => i.title)).toEqual(['Open']);
    expect(JSON.stringify(pub)).not.toContain('x.org');
    expect((await as('alpha')('post', `learning/library/${pub.items[0].id}/open`)).body.url).toBe('https://x.org/a.pdf');
    expect((await admin('get', 'learning/library')).body.total).toBe(2);
  });
});

describe('events, feedback, social', () => {
  it('holds capacity, waitlists, and checks in once', async () => {
    const e = (await admin('post', 'events', { slug: 'run-2026', title: 'Run', startsAt: inH(24), endsAt: inH(26), capacity: 1, status: 'PUBLISHED' })).body;
    await Promise.all(['a', 'b', 'a'].map((x) => as('alpha')('post', 'public/events/run-2026/register', { name: x, email: `${x}@x.org` })));
    const regs = await db.eventRegistration.findMany();
    expect(regs.map((r) => r.status).sort()).toEqual(['REGISTERED', 'WAITLISTED']);
    const ok = regs.find((r) => r.status === 'REGISTERED')!;
    const wait = regs.find((r) => r.status === 'WAITLISTED')!;
    expect((await admin('post', `event-desk/${e.id}/check-in`, { ticketCode: ok.ticketCode })).status).toBe(200);
    expect((await admin('post', `event-desk/${e.id}/check-in`, { ticketCode: ok.ticketCode })).status).toBe(400);
    expect((await admin('post', `event-desk/${e.id}/check-in`, { ticketCode: wait.ticketCode })).status).toBe(400);
  });
  it('one review each; comments wait for moderation', async () => {
    const u = await user('fan@alpha.org', ['donor']);
    const b = { subjectType: 'ngo', subjectId: alpha.id, rating: 4, comment: 'Nice' };
    await u('post', 'feedback', b);
    await u('post', 'feedback', { ...b, rating: 5 });
    expect((await u('post', 'feedback', { ...b, rating: 6 })).status).toBe(422);
    expect((await u('post', 'feedback', { ...b, subjectId: beta.id })).status).toBe(404);
    expect((await as('alpha')('get', `feedback/public/ngo/${alpha.id}`)).body.count).toBe(0);
    const f = (await admin('get', 'feedback')).body;
    expect(f.total).toBe(1);
    await admin('put', `feedback/${f.items[0].id}`, { status: 'APPROVED' });
    expect((await as('alpha')('get', `feedback/public/ngo/${alpha.id}`)).body).toMatchObject({ count: 1, average: 5 });
  });
  it('social posts need a second person to approve', async () => {
    const writer = await user('writer@alpha.org', ['content_creator']);
    expect((await writer('post', 'social-posts', { title: 'T', body: 'x'.repeat(281), channels: ['x'] })).status).toBe(400);
    const p = (await writer('post', 'social-posts', { title: 'T', body: 'Hello', channels: ['x', 'facebook'], hashtags: ['शिक्षा'] })).body;
    expect((await writer('post', `social-workflow/${p.id}/submit`)).status).toBe(200);
    expect((await writer('put', `social-workflow/${p.id}`, { action: 'approve' })).status).toBe(403);
    expect((await admin('put', `social-workflow/${p.id}`, { action: 'approve' })).status).toBe(200);
    expect((await writer('put', `social-posts/${p.id}`, { body: 'Changed' })).status).toBe(400);
    expect((await admin('put', `social-workflow/${p.id}`, { action: 'schedule', scheduledAt: inH(1) })).status).toBe(200);
    expect((await db.socialPost.findFirstOrThrow()).status).toBe('SCHEDULED');
    const own = (await admin('post', 'social-posts', { title: 'Mine', body: 'b', channels: ['x'] })).body;
    await admin('post', `social-workflow/${own.id}/submit`);
    expect((await admin('put', `social-workflow/${own.id}`, { action: 'approve' })).status).toBe(400);
  });
});

describe('CSR, monitoring, content, privacy', () => {
  it('a CSR partner sees only their company and grants cannot be overspent', async () => {
    const [a, b] = await Promise.all(['ACME', 'Globex'].map((name) => admin('post', 'crm/organizations', { name }).then((r: any) => r.body)));
    const g = (await admin('post', 'grants', { organizationId: a.id, title: 'ACME grant', amountMinor: 1000, status: 'ACTIVE' })).body;
    await admin('post', 'grants', { organizationId: b.id, title: 'Globex grant', amountMinor: 1000, status: 'ACTIVE' });
    expect((await admin('post', 'grant-utilisations', { grantId: g.id, amountMinor: 900, category: 'Books', description: 'x', spentAt: new Date() })).status).toBe(201);
    expect((await admin('post', 'grant-utilisations', { grantId: g.id, amountMinor: 101, category: 'Books', description: 'x', spentAt: new Date() })).status).toBe(400);
    const u = await person('csr@acme.com', alpha.id, ['csr_partner']);
    await db.membership.updateMany({ where: { userId: u.id }, data: { organizationId: a.id } });
    const csr = as('alpha', await login('csr@acme.com', 'alpha'));
    const portal = (await csr('get', 'csr/portal')).body;
    expect(portal.grants.map((x: any) => [x.title, x.spentMinor])).toEqual([['ACME grant', 900]]);
    expect((await csr('get', 'grants')).status).toBe(403);
    const inv = (await admin('post', 'invoices', { organizationId: a.id, grantId: g.id, number: 'INV-1', amountMinor: 1000, status: 'SENT' })).body;
    const paid = await Promise.all([1, 2, 3].map(() => admin('post', `invoice-payments/${inv.id}`)));
    expect(paid.filter((r: any) => r.status === 200)).toHaveLength(1);
    expect(await db.ledgerEntry.count({ where: { grantId: g.id } })).toBe(2);
  });
  it('monitoring shows progress to target', async () => {
    const p = (await admin('post', 'programmes', { name: 'Literacy', status: 'PUBLISHED' })).body;
    const i = (await admin('post', 'indicators', { programmeId: p.id, name: 'Readers', unit: 'children', baseline: 100, target: 200 })).body;
    await admin('post', 'indicator-readings', { indicatorId: i.id, value: 150, recordedAt: new Date() });
    expect((await admin('get', 'monitoring')).body.items[0].indicators[0].progress).toBe(50);
  });
  it('pages, redirects and contact', async () => {
    await admin('post', 'pages', { slug: 'about', title: 'About', body: 'Hi' });
    expect((await as('alpha')('get', 'public/pages/about')).status).toBe(404);
    const pg = (await admin('get', 'pages')).body.items[0];
    await admin('put', `pages/${pg.id}`, { status: 'PUBLISHED' });
    expect((await as('alpha')('get', 'public/pages/about')).body.title).toBe('About');
    expect((await as('beta')('get', 'public/pages/about')).status).toBe(404);
    expect((await admin('post', 'redirects', { fromPath: '/old', toPath: 'https://evil.example' })).status).toBe(422);
    expect((await admin('post', 'redirects', { fromPath: '/old', toPath: '//evil.example' })).status).toBe(422);
    expect((await as('alpha')('post', 'public/contact', { name: 'a', email: 'a@x.org', message: 'hi', website: 'spam' })).status).toBe(422);
    expect((await as('alpha')('post', 'public/contact', { name: 'a', email: 'a@x.org', message: 'hi' })).status).toBe(200);
  });
  it('exports and erases personal data, keeping tax records', async () => {
    const u = await person('leaver@alpha.org', alpha.id, ['donor', 'volunteer']);
    const me = as('alpha', await login('leaver@alpha.org', 'alpha'));
    await me('put', 'volunteering/me', { firstName: 'Lea', lastName: 'Ver' });
    const d = await db.donor.create({ data: { tenantId: alpha.id, userId: u.id, fullName: 'Lea Ver', email: 'leaver@alpha.org' } });
    await db.donation.create({ data: { tenantId: alpha.id, donorId: d.id, amountMinor: 100, publicToken: 'tok', status: 'COMPLETED' } });
    const ex = (await me('get', 'privacy/export')).body;
    expect(ex.donors[0].donations).toHaveLength(1);
    expect(JSON.stringify(ex)).not.toContain('"tok"');
    expect((await me('post', 'privacy/requests', { type: 'ERASURE', password: 'wrong' })).status).toBe(400);
    const r = (await me('post', 'privacy/requests', { type: 'ERASURE', password: 'correct-horse-9' })).body;
    expect((await admin('put', `privacy/requests/${r.id}`, { status: 'COMPLETED', resolution: 'Erased as requested' })).status).toBe(200);
    expect(await db.user.findFirst({ where: { email: 'leaver@alpha.org' } })).toBeNull();
    expect(JSON.stringify(await db.volunteer.findMany())).not.toContain('leaver@alpha.org');
    expect((await db.donor.findUniqueOrThrow({ where: { id: d.id } })).fullName).toBe('Lea Ver');
    expect((await me('get', 'auth/profile')).status).toBe(401);
  });
});
