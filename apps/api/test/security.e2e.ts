import { totpAt } from '@vashundhara-foundation/auth';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, boot, clearLimits, db, drain, http, login, mailToken, ngo, PASSWORD, person, shutdown } from './helpers';

let alpha: { id: string };
let beta: { id: string };
beforeAll(async () => {
  await boot();
  alpha = await ngo('alpha');
  beta = await ngo('beta');
  await person('admin@alpha.org', alpha.id, ['tenant_admin']);
  await person('admin@beta.org', beta.id, ['tenant_admin']);
  await person('manager@alpha.org', alpha.id, ['manager']);
  await person('donor@alpha.org', alpha.id, ['donor']);
  await person('auditor@alpha.org', alpha.id, ['auditor']);
  await person('root@platform.org', null, [], { isSystemAdmin: true });
});
afterAll(shutdown);
beforeEach(clearLimits);

describe('accounts', () => {
  it('registers, verifies once, and signs in', async () => {
    const call = as('alpha');
    const body = { email: 'New@Person.org', password: PASSWORD, firstName: 'New', lastName: 'Person', acceptTerms: true };
    expect((await call('post', 'auth/register', body)).status).toBe(200);
    expect((await call('post', 'auth/login', { email: 'new@person.org', password: PASSWORD })).body.error.code).toBe('EMAIL_UNVERIFIED');
    const token = await mailToken('new@person.org');
    expect((await call('post', 'auth/verify-email', { token })).status).toBe(200);
    expect((await call('post', 'auth/verify-email', { token })).status).toBe(400);
    const t = await login('new@person.org', 'alpha');
    const me = (await as('alpha', t)('get', 'auth/session')).body;
    expect(me.roles).toEqual(['donor']);
    expect(me.permissions).toEqual([]);
  });
  it('rejects weak passwords, bad emails and staff roles', async () => {
    const call = as('alpha');
    const base = { email: 'x@y.org', password: PASSWORD, firstName: 'a', lastName: 'b', acceptTerms: true };
    expect((await call('post', 'auth/register', { ...base, password: '1' })).body.error.code).toBe('WEAK_PASSWORD');
    expect((await call('post', 'auth/register', { ...base, email: 'notanemail' })).status).toBe(422);
    expect((await call('post', 'auth/register', { ...base, role: 'tenant_admin' })).status).toBe(403);
    expect((await call('post', 'auth/register', { ...base, role: 'system_admin' })).status).toBe(403);
    expect((await call('post', 'auth/register', { ...base, acceptTerms: false })).status).toBe(422);
  });
  it('gives the same answer for existing and unknown emails', async () => {
    const call = as('alpha');
    const reg = (email: string) => call('post', 'auth/register', { email, password: PASSWORD, firstName: 'a', lastName: 'b', acceptTerms: true });
    const [a, b] = [await reg('admin@alpha.org'), await reg('fresh@alpha.org')];
    expect([a.status, a.body]).toEqual([b.status, b.body]);
    const [c, d] = [await call('post', 'auth/password/forgot', { email: 'admin@alpha.org' }), await call('post', 'auth/password/forgot', { email: 'nobody@alpha.org' })];
    expect([c.status, c.body]).toEqual([d.status, d.body]);
  });
  it('resets a password and ends old sessions', async () => {
    await person('reset@alpha.org', alpha.id, ['donor']);
    const old = await login('reset@alpha.org', 'alpha');
    await as('alpha')('post', 'auth/password/forgot', { email: 'reset@alpha.org' });
    const token = await mailToken('reset@alpha.org');
    expect((await as('alpha')('post', 'auth/password/reset', { token, password: 'brand-new-pass-7' })).status).toBe(200);
    expect((await as('alpha', old)('get', 'auth/profile')).status).toBe(401);
    expect((await as('alpha')('post', 'auth/password/reset', { token, password: 'another-pass-77' })).status).toBe(400);
  });
  it('limits password guessing', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 24; i++) codes.push((await as('alpha')('post', 'auth/login', { email: 'ghost@alpha.org', password: 'nope' })).status);
    expect(codes).toContain(429);
  });
  it('locks an account after ten wrong passwords, even from many addresses', async () => {
    await person('lock@alpha.org', alpha.id, ['donor']);
    for (let i = 0; i < 10; i++) { await clearLimits(); await as('alpha')('post', 'auth/login', { email: 'lock@alpha.org', password: 'nope' }); }
    await clearLimits();
    expect((await as('alpha')('post', 'auth/login', { email: 'lock@alpha.org', password: PASSWORD })).status).toBe(401);
  });
});

describe('sessions', () => {
  const cookies = (r: request.Response) => ((r.headers['set-cookie'] as unknown as string[]) ?? []).map((c) => c.split(';')[0]);
  const signIn = () => request(http).post('/api/v1/auth/login').set('x-vf-host', 'alpha.ngo.test').send({ email: 'donor@alpha.org', password: PASSWORD });

  it('logout ends access at once', async () => {
    const t = await login('donor@alpha.org', 'alpha');
    expect((await as('alpha', t)('get', 'auth/profile')).status).toBe(200);
    await as('alpha', t)('post', 'auth/logout');
    expect((await as('alpha', t)('get', 'auth/profile')).status).toBe(401);
  });
  it('a refresh token is not an access token', async () => {
    const rt = cookies(await signIn()).find((c) => c.startsWith('vf_rt='))!.slice(6);
    expect((await as('alpha', rt)('get', 'auth/profile')).status).toBe(401);
  });
  it('rotates refresh tokens and kills the session when an old one is replayed', async () => {
    const first = cookies(await signIn()).find((c) => c.startsWith('vf_rt='))!;
    const r1 = await request(http).post('/api/v1/auth/refresh').set('x-vf-host', 'alpha.ngo.test').set('cookie', first);
    expect(r1.status).toBe(200);
    const second = cookies(r1).find((c) => c.startsWith('vf_rt='))!;
    await db.session.updateMany({ data: { rotatedAt: new Date(Date.now() - 60_000) } });
    expect((await request(http).post('/api/v1/auth/refresh').set('cookie', first)).status).toBe(401);
    expect((await request(http).post('/api/v1/auth/refresh').set('cookie', second)).status).toBe(401);
  });
  it('cookie writes need the custom header (CSRF)', async () => {
    const c = cookies(await signIn()).join('; ');
    const put = () => request(http).put('/api/v1/auth/profile').set('x-vf-host', 'alpha.ngo.test').set('cookie', c);
    expect((await put().send({ firstName: 'Evil' })).status).toBe(403);
    expect((await put().set('x-requested-with', 'vf').send({ firstName: 'Good' })).status).toBe(200);
  });
  it('does not allow other origins', async () => {
    const r = await request(http).options('/api/v1/auth/login').set('origin', 'https://evil.example').set('access-control-request-method', 'POST');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('two-step verification', () => {
  it('needs a correct, unused code', async () => {
    await person('mfa@alpha.org', alpha.id, ['donor']);
    const t = await login('mfa@alpha.org', 'alpha');
    const me = as('alpha', t);
    const { secret } = (await me('post', 'auth/mfa/setup', { password: PASSWORD })).body;
    expect((await me('post', 'auth/mfa/enable', { code: '000000' })).status).toBe(400);
    const step = Math.floor(Date.now() / 30_000);
    const { backupCodes } = (await me('post', 'auth/mfa/enable', { code: totpAt(secret, step) })).body;
    expect(backupCodes).toHaveLength(10);
    const start = async () => (await as('alpha')('post', 'auth/login', { email: 'mfa@alpha.org', password: PASSWORD })).body;
    const s = await start();
    expect(s.mfaRequired).toBe(true);
    expect(s.accessToken).toBeUndefined();
    expect((await as('alpha', s.challenge)('get', 'auth/profile')).status).toBe(401);
    expect((await as('alpha')('post', 'auth/login/mfa', { challenge: s.challenge, code: totpAt(secret, step) })).status).toBe(401);
    expect((await as('alpha')('post', 'auth/login/mfa', { challenge: s.challenge, code: backupCodes[0] })).status).toBe(200);
    expect((await as('alpha')('post', 'auth/login/mfa', { challenge: s.challenge, code: backupCodes[0] })).status).toBe(401);
  });
});

describe('access control', () => {
  it('anonymous visitors cannot reach staff data', async () => {
    for (const p of ['donors', 'crm/contacts', 'crm/deals', 'volunteers', 'beneficiaries', 'students', 'donations', 'members', 'audit-logs', 'platform/tenants', 'files', 'finance/unsettled'])
      expect((await as('alpha')('get', p)).status, p).toBe(401);
  });
  it('a donor cannot reach staff data', async () => {
    const t = await login('donor@alpha.org', 'alpha');
    for (const p of ['donors', 'crm/contacts', 'volunteers', 'beneficiaries', 'students', 'donations', 'members', 'audit-logs', 'platform/tenants']) expect((await as('alpha', t)('get', p)).status, p).toBe(403);
  });
  it('an admin can open every list', async () => {
    const t = await login('admin@alpha.org', 'alpha');
    for (const p of ['donors', 'donations', 'campaigns', 'subscriptions', 'receipts', 'crm/contacts', 'crm/organizations', 'crm/pipelines', 'crm/deals', 'crm/activities', 'crm/dashboard', 'volunteers', 'shifts', 'skills', 'volunteering/hours', 'beneficiaries', 'cases', 'aid', 'field/visits', 'grants', 'grant-utilisations', 'invoices', 'programmes', 'indicators', 'monitoring', 'students', 'courses', 'lessons', 'live-classes', 'assignments', 'enrolments', 'library', 'events', 'feedback', 'social-posts', 'pages', 'redirects', 'messages', 'privacy/requests', 'members', 'members/invitations', 'roles', 'api-keys', 'webhooks', 'files', 'notifications', 'notification-templates', 'feature-flags', 'translations', 'audit-logs', 'compliance', 'compliance/payment-accounts', 'tenant/settings', 'reports/dashboard', 'reports/monthly', 'report-schedules', 'finance/unsettled'])
      expect((await as('alpha', t)('get', p)).status, p).toBe(200);
  });
  it('an auditor can read finance but change nothing', async () => {
    const t = as('alpha', await login('auditor@alpha.org', 'alpha'));
    expect((await t('get', 'donations')).status).toBe(200);
    expect((await t('post', 'campaigns', { slug: 'aaa', title: 'aaa', goalMinor: 1 })).status).toBe(403);
    expect((await t('post', 'finance/settlements', { csv: 'a' })).status).toBe(403);
  });
  it('platform console is for system admins only', async () => {
    expect((await as('alpha', await login('root@platform.org', 'alpha'))('get', 'platform/overview')).status).toBe(200);
    expect((await as('alpha', await login('admin@alpha.org', 'alpha'))('get', 'platform/overview')).status).toBe(403);
  });
  it('managers cannot grant access they do not hold', async () => {
    const admin = as('alpha', await login('admin@alpha.org', 'alpha'));
    const roles = (await admin('get', 'roles')).body.items as { id: string; name: string }[];
    const role = await admin('post', 'roles', { name: 'hr_lead', displayName: 'HR', permissions: ['members:create', 'members:read', 'members:update', 'roles:read', 'roles:create'] });
    expect(role.status).toBe(201);
    const u = await person('hr@alpha.org', alpha.id, []);
    const m = await db.membership.findFirstOrThrow({ where: { userId: u.id } });
    await db.membershipRole.create({ data: { membershipId: m.id, roleId: role.body.id } });
    const hr = as('alpha', await login('hr@alpha.org', 'alpha'));
    expect((await hr('post', 'members/invitations', { email: 'pal@x.org', roleIds: [roles.find((r) => r.name === 'tenant_admin')!.id] })).status).toBe(403);
    expect((await hr('post', 'roles', { name: 'sneaky', displayName: 'Sneaky', permissions: ['refunds:create'] })).status).toBe(403);
    const adminMember = await db.membership.findFirstOrThrow({ where: { tenantId: alpha.id, user: { email: 'admin@alpha.org' } } });
    expect((await hr('put', `members/${adminMember.id}`, { status: 'SUSPENDED' })).status).toBe(403);
    expect((await hr('put', `members/${m.id}`, { roleIds: [] })).status).toBe(400);
  });
  it('invitations work once, for the invited person', async () => {
    const admin = as('alpha', await login('admin@alpha.org', 'alpha'));
    const manager = ((await admin('get', 'roles')).body.items as { id: string; name: string }[]).find((r) => r.name === 'manager')!;
    expect((await admin('post', 'members/invitations', { email: 'invited@alpha.org', roleIds: [manager.id] })).status).toBe(201);
    const token = await mailToken('invited@alpha.org');
    expect((await as('beta')('post', 'auth/invitation/preview', { token })).status).toBe(400);
    expect((await as('alpha')('post', 'auth/invitation/accept', { token, password: PASSWORD, firstName: 'In', lastName: 'Vited' })).status).toBe(200);
    expect((await as('alpha')('post', 'auth/invitation/accept', { token, password: PASSWORD, firstName: 'In', lastName: 'Vited' })).status).toBe(400);
    expect((await as('alpha', await login('invited@alpha.org', 'alpha'))('get', 'campaigns')).status).toBe(200);
  });
  it('API keys are limited to what was asked and to their own NGO', async () => {
    const admin = as('alpha', await login('admin@alpha.org', 'alpha'));
    const { key } = (await admin('post', 'api-keys', { name: 'k', permissions: ['donors:read'], expiresInDays: 5 })).body;
    const call = (slug: string, path: string) => request(http).get(`/api/v1/${path}`).set('x-vf-host', `${slug}.ngo.test`).set('x-api-key', key);
    expect((await call('alpha', 'donors')).status).toBe(200);
    expect((await call('alpha', 'campaigns')).status).toBe(403);
    expect((await call('alpha', 'auth/profile')).status).toBe(403);
    await db.donor.create({ data: { tenantId: beta.id, fullName: 'Beta Secret' } });
    expect(JSON.stringify((await call('beta', 'donors')).body)).not.toContain('Beta Secret');
    expect((await admin('post', 'api-keys', { name: 'k', permissions: ['*'], expiresInDays: 5 })).status).toBe(422);
  });
  it('suspending a member takes effect immediately', async () => {
    const u = await person('gone@alpha.org', alpha.id, ['manager']);
    const t = await login('gone@alpha.org', 'alpha');
    expect((await as('alpha', t)('get', 'campaigns')).status).toBe(200);
    await db.membership.updateMany({ where: { userId: u.id }, data: { status: 'SUSPENDED' } });
    expect((await as('alpha', t)('get', 'campaigns')).status).toBe(403);
  });
});

describe('tenant isolation', () => {
  it("an admin has no rights on another NGO's site, whatever headers are sent", async () => {
    const t = await login('admin@alpha.org', 'alpha');
    await db.donor.create({ data: { tenantId: beta.id, fullName: 'Beta Donor' } });
    expect((await as('beta', t)('get', 'donors')).status).toBe(403);
    const r = await request(http).get('/api/v1/donors').set('x-vf-host', 'alpha.ngo.test').set('x-tenant-id', beta.id).set('x-tenant-slug', 'beta').set('authorization', `Bearer ${t}`);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain('Beta Donor');
  });
  it('records of another NGO cannot be read, changed, deleted or linked', async () => {
    const mine = as('alpha', await login('admin@alpha.org', 'alpha'));
    const org = await db.organization.create({ data: { tenantId: beta.id, name: 'Beta Org' } });
    const c = await db.contact.create({ data: { tenantId: beta.id, firstName: 'B', lastName: 'C' } });
    expect((await mine('get', `crm/contacts/${c.id}`)).status).toBe(404);
    expect((await mine('put', `crm/contacts/${c.id}`, { firstName: 'X' })).status).toBe(404);
    expect((await mine('delete', `crm/contacts/${c.id}`)).status).toBe(404);
    const link = await mine('post', 'crm/contacts', { firstName: 'A', lastName: 'A', organizationId: org.id });
    expect([link.status, link.body.error?.code]).toEqual([400, 'BAD_REFERENCE']);
    expect((await mine('post', 'crm/contacts', { firstName: 'A', lastName: 'A', tenantId: beta.id })).status).toBe(422);
  });
  it('the database itself refuses cross-NGO links and foreign roles', async () => {
    const org = await db.organization.create({ data: { tenantId: beta.id, name: 'B2' } });
    await expect(db.contact.create({ data: { tenantId: alpha.id, firstName: 'x', lastName: 'y', organizationId: org.id } })).rejects.toThrow();
    const sys = await db.role.findFirstOrThrow({ where: { name: 'system_admin' } });
    const m = await db.membership.findFirstOrThrow({ where: { tenantId: alpha.id } });
    await expect(db.membershipRole.create({ data: { membershipId: m.id, roleId: sys.id } })).rejects.toThrow();
    const custom = await db.role.create({ data: { tenantId: beta.id, name: 'beta_only', displayName: 'b' } });
    await expect(db.membershipRole.create({ data: { membershipId: m.id, roleId: custom.id } })).rejects.toThrow();
  });
  it('every tenant-scoped table has its guard trigger', async () => {
    const missing = await db.$queryRaw<{ t: string }[]>`
      SELECT src.relname || '.' || a.attname AS t FROM pg_constraint k JOIN pg_class src ON src.oid = k.conrelid JOIN pg_class ref ON ref.oid = k.confrelid JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      WHERE k.contype = 'f' AND ref.relname <> 'tenants' AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = k.conrelid AND x.attname = 'tenantId') AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = k.confrelid AND x.attname = 'tenantId')
        AND NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = src.oid AND g.tgname = 'tenant_chk_' || a.attname)`;
    expect(missing).toEqual([]);
  });
  it('audit and ledger rows cannot be deleted', async () => {
    await db.auditLog.create({ data: { action: 'READ', resource: 'x', tenantId: alpha.id } });
    await expect(db.auditLog.deleteMany()).rejects.toThrow();
  });
  it('audit logs never contain secrets', async () => {
    await drain();
    const text = JSON.stringify(await db.auditLog.findMany());
    expect(text).not.toMatch(/\$2[aby]\$/);
    expect(text).not.toContain(PASSWORD);
  });
});

describe('new NGOs', () => {
  it('can sign up, but cannot raise money before approval', async () => {
    const r = await as('alpha')('post', 'auth/register-ngo', { ngoName: 'Gamma Trust', slug: 'gamma', email: 'owner@gamma.org', password: PASSWORD, firstName: 'O', lastName: 'W', acceptTerms: true });
    expect(r.status).toBe(200);
    await as('gamma')('post', 'auth/verify-email', { token: await mailToken('owner@gamma.org') });
    const own = as('gamma', await login('owner@gamma.org', 'gamma'));
    expect((await own('get', 'members')).body.total).toBe(1);
    const give = await as('gamma')('post', 'public/donations', { amountMinor: 50000, donor: { fullName: 'A B', email: 'a@b.org', isIndianCitizen: true } });
    expect(give.body.error.code).toBe('NGO_NOT_ACTIVE');
    const t = await db.tenant.findUniqueOrThrow({ where: { slug: 'gamma' } });
    const root = as('alpha', await login('root@platform.org', 'alpha'));
    expect((await root('put', `platform/tenants/${t.id}`, { status: 'ACTIVE' })).status).toBe(400);
    expect((await own('put', 'compliance', { legalName: 'Gamma Trust' })).status).toBe(200);
    expect((await root('put', `platform/tenants/${t.id}`, { status: 'ACTIVE' })).status).toBe(200);
  });
  it('reserved and taken addresses are refused', async () => {
    const b = { ngoName: 'Xyz', email: 'z@z.org', password: PASSWORD, firstName: 'O', lastName: 'W', acceptTerms: true };
    expect((await as('alpha')('post', 'auth/register-ngo', { ...b, slug: 'admin' })).status).toBe(422);
    expect((await as('alpha')('post', 'auth/register-ngo', { ...b, slug: 'beta' })).status).toBe(409);
  });
});
