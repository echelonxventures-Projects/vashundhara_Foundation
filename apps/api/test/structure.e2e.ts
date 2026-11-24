import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, boot, clearLimits, db, drain, login, ngo, person, shutdown } from './helpers';

type Call = ReturnType<typeof as>;
let alpha: { id: string };
let beta: { id: string };
let root: Call, admin: Call, manager: Call, member: Call, field: Call, betaAdmin: Call;
const user = async (email: string, roles: string[], slug = 'alpha'): Promise<Call> => { await person(email, (slug === 'alpha' ? alpha : beta).id, roles); return as(slug, await login(email, slug)); };
const P = () => `platform/structure/ngos/${alpha.id}`;
const empty = { entities: {}, tables: [], forms: [], rules: [] };
const f = (key: string, type = 'text', more: object = {}) => ({ key, label: key.replace(/_/g, ' '), type, ...more });
/** Merges onto the live structure and publishes as Super Admin. */
async function publish(change: (d: any) => void, id = alpha.id) {
  const o = (await root('get', `platform/structure/ngos/${id}/manage`)).body;
  const d = structuredClone(o.draft?.definition ?? o.live?.definition ?? empty);
  change(d);
  const s = await root('put', `platform/structure/ngos/${id}/manage/draft`, { definition: d, rev: o.draft?.rev ?? 0 });
  if (s.status !== 200) return s;
  return root('post', `platform/structure/ngos/${id}/manage/publish`, { rev: s.body.rev });
}
const discard = (id = alpha.id) => root('delete', `platform/structure/ngos/${id}/manage/draft`);

beforeAll(async () => {
  await boot();
  alpha = await ngo('alpha');
  beta = await ngo('beta');
  await person('root@x.org', null, [], { isSystemAdmin: true });
  root = as('alpha', await login('root@x.org', 'alpha'));
  admin = await user('admin@alpha.org', ['tenant_admin']);
  manager = await user('manager@alpha.org', ['manager']);
  member = await user('member@alpha.org', ['member']);
  field = await user('field@alpha.org', ['field_worker']);
  betaAdmin = await user('admin@beta.org', ['tenant_admin'], 'beta');
});
afterAll(shutdown);
beforeEach(clearLimits);

describe('who may change the structure', () => {
  it('an NGO Administrator needs Super Admin permission, and loses it when withdrawn', async () => {
    expect((await admin('get', 'structure/manage')).status).toBe(403);
    expect((await admin('put', 'structure/manage/draft', { definition: empty, rev: 0 })).body.error.code).toBe('NOT_PERMITTED');
    expect((await admin('put', `${P()}/policy`, { ngoAdminAllowed: true })).status).toBe(403);
    expect((await root('put', `${P()}/policy`, { ngoAdminAllowed: true })).status).toBe(200);
    expect((await admin('get', 'structure')).body.canManage).toBe(true);
    const s = await admin('put', 'structure/manage/draft', { definition: { ...empty, entities: { donors: { fields: [f('blood_group')] } } }, rev: 0 });
    expect(s.status).toBe(200);
    // Super Admin approves by default.
    expect((await admin('get', 'structure/manage')).body.canPublish).toBe(false);
    expect((await admin('post', 'structure/manage/publish', { rev: s.body.rev })).body.error.code).toBe('NEEDS_APPROVAL');
    expect(await db.structureVersion.count({ where: { status: 'PUBLISHED' } })).toBe(0);
    expect((await root('post', `${P()}/manage/publish`, { rev: s.body.rev })).body.number).toBe(1);
    expect((await manager('get', 'structure/manage')).status).toBe(403);
    expect((await manager('get', 'structure')).body.canManage).toBe(false);
    expect((await betaAdmin('get', 'structure/manage')).status).toBe(403);
    expect((await admin('post', `${P()}/manage/purge`, { entity: 'donors', key: 'blood_group', confirm: 'blood_group' })).status).toBe(403);
    await root('put', `${P()}/policy`, { ngoAdminAllowed: false });
    expect((await admin('get', 'structure/manage')).status).toBe(403);
  });
  it('review: sent, withdrawn, sent back, changed after sending, approved', async () => {
    await root('put', `${P()}/policy`, { ngoAdminAllowed: true });
    const save = async (label: string, rev: number) => (await admin('put', 'structure/manage/draft', { definition: { ...empty, entities: { donors: { fields: [f('blood_group', 'text', { label })] } } }, rev })).body.rev as number;
    const live = async () => (await db.structureVersion.findFirstOrThrow({ where: { tenantId: alpha.id, status: 'PUBLISHED' } })).number;
    const queue = async () => (await root('get', 'platform/structure/reviews')).body.items;
    let rev = await save('Blood type', 0);
    expect((await manager('post', 'structure/manage/submit', { rev })).status).toBe(403);
    expect((await betaAdmin('post', 'structure/manage/submit', { rev })).status).toBe(403);
    expect((await admin('post', 'structure/manage/submit', { rev: rev + 1 })).status).toBe(409);
    expect((await admin('post', 'structure/manage/submit', { rev, note: 'Please look' })).status).toBe(200);
    expect((await admin('post', 'structure/manage/submit', { rev })).status).toBe(409);
    expect(await queue()).toMatchObject([{ by: 'admin@alpha.org', submitNote: 'Please look', tenant: { id: alpha.id } }]);
    expect((await admin('get', 'platform/structure/reviews')).status).toBe(403);
    expect(await db.notification.count({ where: { recipient: 'root@x.org', subject: { contains: 'to review' } } })).toBe(1);
    expect((await admin('delete', 'structure/manage/submit')).status).toBe(200);
    expect(await queue()).toEqual([]);
    await admin('post', 'structure/manage/submit', { rev });
    expect((await admin('post', `${P()}/manage/return`, { rev, note: 'mine now' })).status).toBe(403);
    expect((await root('post', `${P()}/manage/return`, { rev, note: 'no' })).status).toBe(422);
    expect((await root('post', `${P()}/manage/return`, { rev, note: 'Use a clearer name' })).status).toBe(200);
    expect((await admin('get', 'structure/manage')).body.draft).toMatchObject({ reviewNote: 'Use a clearer name', submittedAt: null });
    expect(await db.notification.count({ where: { recipient: 'admin@alpha.org', content: { contains: 'Use a clearer name' } } })).toBe(2);
    expect((await root('post', `${P()}/manage/return`, { rev, note: 'Again please' })).status).toBe(409);
    // What is approved is exactly what was reviewed.
    await admin('post', 'structure/manage/submit', { rev });
    const reviewed = rev;
    rev = await save('Something else', rev);
    expect(await queue()).toEqual([]);
    expect((await root('post', `${P()}/manage/publish`, { rev: reviewed })).status).toBe(409);
    expect(await live()).toBe(1);
    await admin('post', 'structure/manage/submit', { rev });
    expect((await root('post', `${P()}/manage/publish`, { rev, note: 'Good' })).body.number).toBe(2);
    expect(await queue()).toEqual([]);
    expect((await admin('get', 'structure/manage')).body.versions[0]).toMatchObject({ by: 'root@x.org', askedBy: 'admin@alpha.org' });
    expect(await db.auditLog.count({ where: { resource: 'structure', action: 'APPROVE', tenantId: alpha.id } })).toBe(1);
    expect(await db.notification.count({ where: { recipient: 'admin@alpha.org', channel: 'IN_APP', subject: { contains: 'live' } } })).toBe(1);
    // A draft that cannot be published cannot be sent.
    const bad = (await admin('put', 'structure/manage/draft', { definition: { ...empty, tables: [{ key: 'void_one', title: 'Void', fields: [] }] }, rev: 0 })).body.rev;
    expect((await admin('post', 'structure/manage/submit', { rev: bad })).body.error.code).toBe('STRUCTURE');
    await admin('delete', 'structure/manage/draft');
  });
  it('direct publishing works only while Super Admin enables it for that NGO', async () => {
    const draft = async (label: string) => (await admin('put', 'structure/manage/draft', { definition: { ...empty, entities: { donors: { fields: [f('blood_group', 'text', { label })] } } }, rev: 0 })).body.rev;
    await root('put', `platform/structure/ngos/${beta.id}/policy`, { ngoAdminPublish: true });
    // Publishing alone is not enough: editing must be permitted too, and one NGO's switch does not help another.
    expect((await betaAdmin('get', 'structure/manage')).status).toBe(403);
    const rev = await draft('Group A');
    expect((await admin('post', 'structure/manage/publish', { rev })).body.error.code).toBe('NEEDS_APPROVAL');
    expect((await admin('put', `${P()}/policy`, { ngoAdminPublish: true })).status).toBe(403);
    await root('put', `${P()}/policy`, { ngoAdminPublish: true });
    expect((await admin('get', 'structure/manage')).body.canPublish).toBe(true);
    expect((await admin('post', 'structure/manage/publish', { rev })).body.number).toBe(3);
    await root('put', `${P()}/policy`, { ngoAdminPublish: false });
    const next = await draft('Group B');
    expect((await admin('post', 'structure/manage/publish', { rev: next })).status).toBe(403);
    await admin('delete', 'structure/manage/draft');
    await root('put', `platform/structure/ngos/${beta.id}/policy`, { ngoAdminPublish: false });
    await root('put', `${P()}/policy`, { ngoAdminAllowed: false });
  });
  it('limits, stale drafts and locked records', async () => {
    await root('put', `${P()}/policy`, { maxFields: 1 });
    expect((await publish((d) => d.entities.donors.fields.push(f('extra_one')))).body.error.code).toBe('LIMIT');
    await root('put', `${P()}/policy`, { maxFields: 150 });
    const a = await root('put', `${P()}/manage/draft`, { definition: empty, rev: 0 });
    expect((await root('put', `${P()}/manage/draft`, { definition: empty, rev: 0 })).body.error.code).toBe('STALE');
    expect((await root('put', `${P()}/manage/draft`, { definition: empty, rev: a.body.rev + 5 })).status).toBe(409);
    expect((await root('post', `${P()}/manage/publish`, { rev: a.body.rev + 5 })).status).toBe(409);
    await discard();
    for (const bad of ['receipts', 'audit', 'webhooks', 'nothing']) {
      expect((await publish((d) => { d.entities[bad] = { fields: [f('some_field')] }; })).status, bad).toBe(422);
      await discard();
    }
    expect((await publish((d) => { d.entities.donations = { fields: [], layout: { hidden: ['status'] } }; })).status).toBe(422);
    await discard();
    expect((await root('put', `${P()}/manage/draft`, { definition: { ...empty, entities: { donors: { fields: [f('constructor!')] } } }, rev: 0 })).status).toBe(422);
  });
});

describe('extra fields', () => {
  it('are checked, stored, filtered, searched and kept inside one NGO', async () => {
    expect((await publish((d) => {
      d.entities.donors.fields = [f('blood_group', 'select', { choices: [{ value: 'a', label: 'A+' }, { value: 'o', label: 'O+' }], filter: true }), f('nickname', 'text', { search: true, personal: true }), f('member_no', 'number', { unique: true, required: true })];
    })).status).toBe(200);
    expect((await admin('post', 'donors', { fullName: 'No number' })).body.error.details[0].path).toBe('custom.member_no');
    expect((await db.donor.count({ where: { fullName: 'No number' } }))).toBe(0);
    expect((await admin('post', 'donors', { fullName: 'X', custom: { member_no: 1, blood_group: 'zz' } })).status).toBe(422);
    expect((await admin('post', 'donors', { fullName: 'X', custom: { member_no: 1, hacker: 1 } })).status).toBe(422);
    const a = (await admin('post', 'donors', { fullName: 'Asha', custom: { member_no: 1, blood_group: 'o', nickname: 'Zebra_1' } })).body;
    expect(a.custom).toEqual({ member_no: 1, blood_group: 'o', nickname: 'Zebra_1' });
    expect((await admin('post', 'donors', { fullName: 'Copy', custom: { member_no: 1 } })).status).toBe(422);
    const both = await Promise.all([2, 2].map(() => admin('post', 'donors', { fullName: 'Race', custom: { member_no: 2 } })));
    expect(both.map((r) => r.status).sort()).toEqual([201, 422]);
    expect((await admin('get', 'donors?cf_blood_group=o')).body.items.map((x: any) => x.fullName)).toEqual(['Asha']);
    expect((await admin('get', 'donors?q=zebra_')).body.total).toBe(1);
    expect((await admin('get', 'donors?q=ze%25ra')).body.total).toBe(0);
    expect((await admin('put', `donors/${a.id}`, { notes: 'hello' })).body.custom.member_no).toBe(1);
    expect((await admin('put', `donors/${a.id}`, { custom: { member_no: null } })).status).toBe(422);
    const log = await db.auditLog.findFirstOrThrow({ where: { resource: 'donor', resourceId: a.id, action: 'CREATE' } });
    expect(JSON.stringify(log.newValues)).not.toContain('Zebra');
    expect((await betaAdmin('post', 'donors', { fullName: 'Beta', custom: { member_no: 5 } })).status).toBe(422);
    expect((await betaAdmin('post', 'donors', { fullName: 'Beta' })).status).toBe(201);
    expect((await betaAdmin('get', 'donors')).body.items[0].custom).toBeUndefined();
    expect((await as('beta')('get', 'campaigns')).status).toBe(401);
  });
  it('layout rules are enforced by the API', async () => {
    expect((await publish((d) => { d.entities.organizations = { fields: [], layout: { required: ['phone'], hidden: ['legalName'], labels: { name: 'Partner name' }, choices: { industry: ['Bank', 'Steel'] } } }; })).status).toBe(200);
    expect((await admin('post', 'crm/organizations', { name: 'A' })).body.error.details[0].path).toBe('phone');
    expect((await admin('post', 'crm/organizations', { name: 'A', phone: '999', industry: 'Tea' })).status).toBe(422);
    expect((await admin('post', 'crm/organizations', { name: 'A', phone: '999', industry: 'Bank' })).status).toBe(201);
    expect((await member('get', 'structure')).body.entities.organizations.layout.labels.name).toBe('Partner name');
    expect((await field('get', 'structure')).body.entities.organizations).toBeUndefined();
  });
  it('donations take extra fields and nothing else', async () => {
    await publish((d) => { d.entities.donations = { fields: [f('thank_you_call', 'bool')] }; });
    const don = (await admin('post', 'donations', { amountMinor: 50000, method: 'CASH', receivedAt: new Date(Date.now() - 3600_000), donor: { fullName: 'Cash Giver', isIndianCitizen: true } }));
    expect(don.status, JSON.stringify(don.body)).toBe(201);
    const id = (await db.donation.findFirstOrThrow({ where: { tenantId: alpha.id } })).id;
    expect((await admin('put', `donation-details/${id}`, { custom: { thank_you_call: true } })).body.custom.thank_you_call).toBe(true);
    expect((await admin('put', `donation-details/${id}`, { amountMinor: 1, custom: {} })).status).toBe(422);
    expect((await admin('put', `donation-details/${id}`, { custom: { amountMinor: 1 } })).status).toBe(422);
    expect((await betaAdmin('get', `donation-details/${id}`)).status).toBe(404);
    expect((await member('put', `donation-details/${id}`, { custom: {} })).status).toBe(403);
  });
});

describe('changing a live structure', () => {
  it('previews impact, converts types safely, archives, restores and purges', async () => {
    await publish((d) => { d.entities.students = { fields: [f('marks', 'text'), f('fee', 'money')] }; });
    const s1 = (await admin('post', 'students', { fullName: 'S1', custom: { marks: '70', fee: 12550 } })).body;
    const s2 = (await admin('post', 'students', { fullName: 'S2', custom: { marks: 'absent' } })).body;
    const toNumber = (d: any) => { d.entities.students.fields.find((x: any) => x.key === 'marks').type = 'number'; };
    const no = await publish(toNumber);
    expect(no.status).toBe(422);
    expect(no.body.error.details[0].message).toMatch(/1 of 2 values/);
    expect((await root('get', `${P()}/manage/preview`)).body.changes[0]).toMatchObject({ blocked: true, records: 2 });
    await discard();
    await admin('put', `students/${s2.id}`, { custom: { marks: '55' } });
    expect((await publish((d) => { toNumber(d); d.entities.students.fields.find((x: any) => x.key === 'fee').type = 'text'; })).body.converted).toBe(3);
    expect((await admin('get', `students/${s1.id}`)).body.custom).toEqual({ marks: 70, fee: '125.5' });
    // Removing a field only hides it.
    await publish((d) => { d.entities.students.fields = d.entities.students.fields.filter((x: any) => x.key !== 'marks'); });
    expect((await admin('get', `students/${s1.id}`)).body.custom).toEqual({ fee: '125.5' });
    expect((await root('post', `${P()}/manage/purge`, { entity: 'students', key: 'fee', confirm: 'fee' })).status).toBe(400);
    const live = (await root('get', `${P()}/manage`)).body.live.number;
    const back = (await root('post', `${P()}/manage/restore/${live - 1}`)).body;
    expect((await root('post', `${P()}/manage/publish`, { rev: back.rev })).status).toBe(200);
    expect((await admin('get', `students/${s1.id}`)).body.custom.marks).toBe(70);
    await publish((d) => { d.entities.students.fields = d.entities.students.fields.filter((x: any) => x.key !== 'marks'); });
    expect((await root('get', `${P()}/manage/export?entity=students&key=marks`)).body.csv).toContain('70');
    expect((await root('post', `${P()}/manage/purge`, { entity: 'students', key: 'marks', confirm: 'wrong' })).status).toBe(400);
    expect((await root('post', `${P()}/manage/purge`, { entity: 'students', key: 'marks', confirm: 'marks' })).body.removed).toBe(2);
    expect(JSON.stringify((await db.customValue.findMany({ where: { entity: 'students' } })).map((x) => x.data))).not.toContain('marks');
    expect((await db.auditLog.count({ where: { resource: 'structure', action: 'DELETE', tenantId: alpha.id } }))).toBe(1);
  });
});

describe('custom tables', () => {
  let trip: any;
  it('have access by role, links, filters, sorting and export', async () => {
    expect((await publish((d) => {
      d.tables.push({ key: 'trips', title: 'Ambulance trips', fields: [f('town', 'text', { required: true, search: true }), f('km', 'number'), f('cost', 'money'), f('donor', 'ref', { ref: 'donors' }), f('title', 'text'), f('contact', 'email', { personal: true }), f('kind', 'select', { filter: true, choices: [{ value: 'urgent', label: 'Urgent' }, { value: 'normal', label: 'Normal' }] })], access: { read: ['manager', 'field_worker'], create: ['field_worker'], update: ['manager'], delete: [] } });
      d.tables.push({ key: 'fuel', title: 'Fuel', fields: [f('litres', 'number', { required: true }), f('trip', 'ref', { ref: 'x:trips' })] });
    })).status).toBe(200);
    const donor = await db.donor.findFirstOrThrow({ where: { tenantId: alpha.id } });
    const foreign = await db.donor.findFirstOrThrow({ where: { tenantId: beta.id } });
    expect((await field('post', 'records/trips', { km: 3 })).status).toBe(422);
    expect((await field('post', 'records/trips', { town: 'X', donor: foreign.id })).status).toBe(422);
    trip = (await field('post', 'records/trips', { town: 'Pune', km: 9, cost: 150000, donor: donor.id, title: 'mine', kind: 'urgent' })).body;
    expect(trip.custom.title).toBe('mine');
    expect((await field('post', 'records/trips', { town: 'Agra', km: 100, kind: 'normal' })).status).toBe(201);
    expect((await manager('post', 'records/trips', { town: 'No' })).status).toBe(403);
    expect((await field('put', `records/trips/${trip.id}`, { km: 1 })).status).toBe(403);
    expect((await manager('put', `records/trips/${trip.id}`, { km: 10 })).body.custom).toMatchObject({ km: 10, town: 'Pune' });
    expect((await manager('delete', `records/trips/${trip.id}`)).status).toBe(403);
    expect((await member('get', 'records/trips')).status).toBe(403);
    expect((await member('get', 'structure')).body.tables).toEqual([]);
    expect((await betaAdmin('get', 'records/trips')).status).toBe(404);
    expect((await betaAdmin('get', `records/trips/${trip.id}`)).status).toBe(404);
    const l = (await manager('get', 'records/trips?sort=-km')).body;
    expect(l.items.map((x: any) => x.custom.km)).toEqual([100, 10]);
    expect(l.refs[donor.id]).toBe(donor.fullName);
    expect((await field('get', 'records/trips')).body.refs[donor.id]).toBe('Linked record');
    expect((await manager('get', 'records/trips?cf_kind=urgent')).body.total).toBe(1);
    expect((await manager('get', 'records/trips?q=pun')).body.total).toBe(1);
    expect((await manager('get', "records/trips?sort=km';drop table users--")).status).toBe(200);
    expect((await manager('get', 'records/trips/export')).body.csv).toContain('Pune,10,1500');
    expect((await field('get', 'records/trips/export')).status).toBe(403);
    expect((await manager('post', 'records/fuel', { litres: 4, trip: trip.id })).status).toBe(201);
    const fuel = (await field('get', 'structure')).body.tables;
    expect(fuel.map((t: any) => t.key)).toEqual(['trips']);
    expect(fuel[0].can).toEqual(['read', 'create']);
    expect(fuel[0].access).toBeUndefined();
  });
  it('a table in use cannot be purged, and archiving hides it without losing rows', async () => {
    const archive = (k: string) => publish((d) => { d.tables = d.tables.filter((t: any) => t.key !== k); });
    expect((await archive('trips')).status).toBe(422);
    await discard();
    await archive('fuel');
    expect((await manager('get', 'records/fuel')).status).toBe(404);
    expect(await db.customRecord.count({ where: { tableKey: 'fuel' } })).toBe(1);
    expect((await root('post', `${P()}/manage/purge`, { entity: 'x:fuel', key: null, confirm: 'fuel' })).body.removed).toBe(1);
  });
  it('the database refuses rows that are not tied to an NGO', async () => {
    await expect(db.customRecord.create({ data: { tenantId: 'nope', tableKey: 'trips', title: 'x' } })).rejects.toThrow();
    await expect(db.customRecord.create({ data: { tenantId: alpha.id, tableKey: 'trips', title: 'x', data: [1] } })).rejects.toThrow();
  });
});

describe('forms and rules', () => {
  it('a public form adds one row, needs consent, and cannot reach other fields', async () => {
    expect((await publish((d) => {
      d.tables.push({ key: 'requests', title: 'Help requests', fields: [f('person', 'text', { required: true }), f('mail', 'email'), f('amount', 'money'), f('internal_note', 'text')] });
      d.forms.push({ key: 'help', title: 'Ask for help', table: 'requests', access: 'PUBLIC', active: true, fields: [{ key: 'person' }, { key: 'mail', required: true }, { key: 'amount' }] }, { key: 'inside', title: 'Inside', table: 'requests', access: 'MEMBERS', active: true, fields: [{ key: 'person' }] });
      d.rules.push({ key: 'big_ask', name: 'Big ask', entity: 'x:requests', on: 'CREATED', active: true, conditions: [{ field: 'amount', op: 'gt', value: '1000' }], actions: [{ type: 'NOTIFY_ROLE', role: 'manager', channel: 'IN_APP', subject: 'Request from {{person}}', body: '{{person}} asked for {{amount}}' }, { type: 'TASK', subject: 'Call {{person}}', dueInDays: 2 }, { type: 'EMAIL_FIELD', field: 'mail', subject: 'We got it', body: 'Thank you {{person}}' }, { type: 'WEBHOOK' }] },
        { key: 'donor_saved', name: 'Donor changed', entity: 'donors', on: 'UPDATED', active: true, conditions: [{ field: 'custom.blood_group', op: 'changed' }], actions: [{ type: 'TASK', subject: 'Check {{fullName}}', dueInDays: 0 }] });
    })).status).toBe(200);
    const out = as('alpha');
    const form = (await out('get', 'public/forms/help')).body;
    expect(form.fields.map((x: any) => [x.key, x.required])).toEqual([['person', true], ['mail', true], ['amount', undefined]]);
    expect((await out('get', 'public/forms/inside')).status).toBe(401);
    expect((await member('get', 'public/forms/inside')).status).toBe(200);
    expect((await as('beta')('get', 'public/forms/help')).status).toBe(404);
    const values = { person: 'Mina', mail: 'Mina@Help.org', amount: 500000 };
    expect((await out('post', 'public/forms/help', { values })).body.error.code).toBe('CONSENT');
    expect((await out('post', 'public/forms/help', { values: { ...values, internal_note: 'x' }, consent: true })).status).toBe(422);
    expect((await out('post', 'public/forms/help', { values, consent: true, website: 'spam' })).status).toBe(200);
    expect(await db.customRecord.count({ where: { tableKey: 'requests' } })).toBe(0);
    expect((await out('post', 'public/forms/help', { values, consent: true })).body).toEqual({ ok: true });
    expect(await db.consentRecord.count({ where: { purpose: 'form:help', email: 'mina@help.org' } })).toBe(1);
    expect((await out('get', 'records/requests')).status).toBe(401);
    await drain();
    const notes = await db.notification.findMany({ where: { tenantId: alpha.id, metadata: { path: ['rule'], equals: 'big_ask' } } });
    expect(notes.find((n) => n.channel === 'IN_APP')).toMatchObject({ subject: 'Request from Mina', content: 'Mina asked for 5000' });
    expect(notes.find((n) => n.channel === 'EMAIL')).toMatchObject({ recipient: 'mina@help.org', content: 'Thank you {{person}}' });
    expect(await db.crmActivity.count({ where: { subject: 'Call Mina', type: 'TASK' } })).toBe(1);
    // The same address is not written to again the same day.
    await out('post', 'public/forms/help', { values, consent: true });
    await out('post', 'public/forms/help', { values: { person: 'Small', mail: 's@s.org', amount: 100 }, consent: true });
    await drain();
    expect(await db.notification.count({ where: { recipient: 'mina@help.org', channel: 'EMAIL' } })).toBe(1);
    expect(await db.crmActivity.count({ where: { subject: 'Call Small' } })).toBe(0);
    const d = await db.donor.findFirstOrThrow({ where: { fullName: 'Asha' } });
    await admin('put', `donors/${d.id}`, { notes: 'again' });
    await admin('put', `donors/${d.id}`, { custom: { blood_group: 'a' } });
    await drain();
    expect(await db.crmActivity.count({ where: { subject: 'Check Asha' } })).toBe(1);
  });
});

describe('templates and privacy', () => {
  it('apply to many NGOs, never overwrite, and can start new ones', async () => {
    const t = (await root('post', 'platform/structure/templates', { name: 'Health NGO', fromTenantId: alpha.id, isDefault: true })).body;
    expect((await admin('get', 'platform/structure/templates')).status).toBe(403);
    await root('put', `platform/structure/ngos/${beta.id}/manage/draft`, { definition: { ...empty, entities: { donors: { fields: [f('nickname', 'number')] } } }, rev: 0 });
    const r = (await root('post', `platform/structure/templates/${t.id}/apply`, { tenantIds: [alpha.id, beta.id], publish: true })).body.results;
    expect(r.find((x: any) => x.id === beta.id)).toMatchObject({ status: 'DRAFT' });
    expect(r.find((x: any) => x.id === beta.id).skipped).toContain('Donors: nickname');
    expect((await betaAdmin('get', 'structure')).body.tables).toEqual([]);
    await discard(beta.id);
    const again = (await root('post', `platform/structure/templates/${t.id}/apply`, { tenantIds: [beta.id], publish: true })).body.results;
    expect(again[0].status).toBe('PUBLISHED');
    expect((await betaAdmin('get', 'records/trips')).body.total).toBe(0);
    const reg = await as('alpha')('post', 'auth/register-ngo', { ngoName: 'Gamma Trust', slug: 'gamma', email: 'g@gamma.org', password: 'correct-horse-9', firstName: 'G', lastName: 'G', acceptTerms: true });
    expect(reg.status).toBeLessThan(300);
    const gamma = await db.tenant.findUniqueOrThrow({ where: { slug: 'gamma' } });
    expect(await db.structureVersion.count({ where: { tenantId: gamma.id, status: 'PUBLISHED' } })).toBe(1);
  });
  it('a person gets their extra data, and erasure removes it', async () => {
    const u = await user('asha@alpha.org', ['donor']);
    const me = await db.user.findUniqueOrThrow({ where: { email: 'asha@alpha.org' } });
    const d = await db.donor.findFirstOrThrow({ where: { fullName: 'Asha' } });
    await db.donor.update({ where: { id: d.id }, data: { userId: me.id } });
    await field('post', 'records/trips', { town: 'Goa', contact: 'asha@alpha.org' });
    const x = (await u('get', 'privacy/export')).body;
    expect(JSON.stringify(x.more)).toContain('Zebra_1');
    expect(JSON.stringify(x.more)).toContain('Goa');
    const q = (await u('post', 'privacy/requests', { type: 'ERASURE', password: 'correct-horse-9' })).body;
    expect((await admin('put', `privacy/requests/${q.id}`, { status: 'COMPLETED', resolution: 'Done as asked' })).status).toBe(200);
    expect(await db.customValue.count({ where: { recordId: d.id } })).toBe(0);
    const row = await db.customRecord.findFirstOrThrow({ where: { tableKey: 'trips', data: { path: ['town'], equals: 'Goa' } } });
    expect(row.data).toEqual({ town: 'Goa' });
  });
});
