import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, boot, clearLimits, db, drain, login, ngo, person, SECRETS, shutdown, sign, webhook } from './helpers';

let mock: Map<string, any>;
let admin: ReturnType<typeof as>;
let alpha: { id: string };
const donor = { fullName: 'Asha Rao', email: 'asha@example.org', isIndianCitizen: true };
const give = (b: object = {}) => as('alpha')('post', 'public/donations', { amountMinor: 250000, donor, ...b });
let n = 0;
async function pay(d: any, over: object = {}) {
  const id = `pay_${++n}`;
  mock.set(id, { id, orderId: d.orderId, amountMinor: d.amountMinor, currency: 'INR', status: 'captured', feeMinor: 5000, ...over });
  return { id, res: await as('alpha')('post', `public/donations/${d.donationId}/confirm`, { token: d.token, paymentId: id, signature: sign(d.orderId, id) }) };
}
async function balanced() {
  const rows = await db.ledgerEntry.groupBy({ by: ['journalId'], _sum: { debitMinor: true, creditMinor: true } });
  for (const r of rows) expect(r._sum.debitMinor).toBe(r._sum.creditMinor);
}
beforeAll(async () => {
  await boot();
  mock = (await import('../src/modules/fundraising/gateway')).mockPayments;
  alpha = await ngo('alpha');
  await ngo('beta');
  await person('admin@alpha.org', alpha.id, ['tenant_admin']);
  await person('asha@example.org', alpha.id, ['donor']);
  await person('other@example.org', alpha.id, ['donor']);
  admin = as('alpha', await login('admin@alpha.org', 'alpha'));
  expect((await give()).body.error.code).toBe('PAYMENTS_NOT_READY');
  expect((await admin('put', 'compliance/payment-accounts', { provider: 'MOCK', fund: 'DOMESTIC', ...SECRETS, isActive: true })).status).toBe(200);
  await admin('post', 'campaigns', { slug: 'school-kits', title: 'School kits', goalMinor: 100000000, status: 'ACTIVE' });
});
afterAll(shutdown);
beforeEach(clearLimits);

describe('donations', () => {
  it('stores gateway secrets encrypted and never returns them', async () => {
    const row = await db.paymentAccount.findFirstOrThrow();
    expect(row.keySecretEnc).not.toContain(SECRETS.keySecret);
    expect(JSON.stringify((await admin('get', 'compliance/payment-accounts')).body)).not.toMatch(/Enc|mock-secret/);
  });
  it('takes a verified payment once, with receipt, ledger and thank-you', async () => {
    const d = (await give({ campaignSlug: 'school-kits' })).body;
    const { id, res } = await pay(d);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.receiptNumber).toMatch(/^R\/\d{4}-\d{2}\/\d{5}$/);
    const ev = { event: 'payment.captured', payload: { payment: { entity: { id, order_id: d.orderId, amount: 250000, currency: 'INR', fee: 5000 } } } };
    await Promise.all([webhook('alpha', ev, 'evt_1'), webhook('alpha', ev, 'evt_1'), webhook('alpha', ev, 'evt_1b')]);
    await drain();
    expect(await db.receipt.count({ where: { donationId: d.donationId } })).toBe(1);
    expect(await db.ledgerEntry.count({ where: { donationId: d.donationId } })).toBe(2);
    expect(await db.notification.count({ where: { recipient: donor.email } })).toBe(1);
    await balanced();
    expect((await as('alpha')('get', 'public/campaigns/school-kits')).body.raisedMinor).toBe(250000);
  });
  it('completes from the webhook alone when the browser closes', async () => {
    const d = (await give()).body;
    expect((await webhook('alpha', { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_w', order_id: d.orderId, amount: 250000, currency: 'INR' } } } }, 'evt_2')).status).toBe(200);
    await drain();
    expect((await as('alpha')('get', `public/donations/${d.donationId}?token=${d.token}`)).body.status).toBe('COMPLETED');
  });
  it('refuses forged signatures, tampered amounts and other orders', async () => {
    const d = (await give()).body;
    const bad = await as('alpha')('post', `public/donations/${d.donationId}/confirm`, { token: d.token, paymentId: 'pay_x', signature: 'f'.repeat(64) });
    expect(bad.body.error.code).toBe('BAD_SIGNATURE');
    expect((await pay(d, { amountMinor: 100 })).res.status).toBe(409);
    expect((await pay(d, { orderId: 'order_other' })).res.status).toBe(400);
    expect((await webhook('alpha', { event: 'payment.captured' }, 'evt_x', 'wrong-secret')).status).toBe(403);
    expect((await webhook('beta', { event: 'payment.captured' }, 'evt_x')).status).toBe(403);
    expect((await as('alpha')('get', `public/donations/${d.donationId}?token=wrong`)).status).toBe(404);
    expect((await db.donation.findUniqueOrThrow({ where: { id: d.donationId } })).status).toBe('PENDING');
  });
  it('keeps receipt numbers unique and gap-free under load', async () => {
    const ds = await Promise.all(Array.from({ length: 12 }, () => give().then((r) => r.body)));
    const rs = await Promise.all(ds.map((d) => pay(d)));
    expect(rs.every((r) => r.res.body.status === 'COMPLETED')).toBe(true);
    const seqs = (await db.receipt.findMany({ where: { tenantId: alpha.id, kind: 'GENERAL' }, orderBy: { seq: 'asc' } })).map((r) => r.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
  });
  it('blocks foreign donations until FCRA is verified', async () => {
    expect((await give({ donor: { ...donor, isIndianCitizen: false } })).body.error.code).toBe('FOREIGN_NOT_ACCEPTED');
    await admin('put', 'compliance', { legalName: 'alpha Trust', pan: 'AAATA1234A', reg80G: '80G-alpha', fcraNo: 'FC1', fcraValidUntil: '2030-01-01' });
    expect((await give({ donor: { ...donor, isIndianCitizen: false } })).body.error.code).toBe('FOREIGN_NOT_ACCEPTED');
  });
  it('validates amount and PAN', async () => {
    expect((await give({ amountMinor: 1 })).status).toBe(422);
    expect((await give({ amountMinor: 500 })).body.error.code).toBe('TOO_SMALL');
    expect((await give({ amountMinor: 1e15 })).status).toBe(422);
    expect((await give({ amountMinor: 1000.5 })).status).toBe(422);
    expect((await give({ wants80G: true })).body.error.code).toBe('PAN_REQUIRED');
    expect((await give({ donor: { ...donor, pan: 'nope' } })).status).toBe(422);
  });
});

describe('80G', () => {
  it('issues an 80G receipt, encrypts PAN, and lists it in Form 10BD', async () => {
    const d = (await give({ wants80G: true, donor: { ...donor, fullName: 'Tax Payer', pan: 'ABCDE1234F' } })).body;
    const { res } = await pay(d);
    expect(res.body.receiptNumber).toMatch(/^80G\//);
    const rec = await db.donation.findUniqueOrThrow({ where: { id: d.donationId }, include: { donor: true } });
    expect(rec.donor.panEnc).not.toContain('ABCDE1234F');
    expect(JSON.stringify((await admin('get', `donations/${d.donationId}`)).body)).not.toContain('panEnc');
    const f = (await admin('get', 'finance/form-10bd')).body;
    expect(f.csv).toContain('ABCDE1234F');
    expect(f.included).toBe(1);
    expect(f.excluded).toBeGreaterThan(0);
  });
  it('does not give 80G for cash above Rs 2,000', async () => {
    const p = { fullName: 'Cash Giver', isIndianCitizen: true, pan: 'ABCDE1234F' };
    const big = (await admin('post', 'donations', { amountMinor: 200100, method: 'CASH', receivedAt: new Date(), donor: p, wants80G: true })).body;
    const small = (await admin('post', 'donations', { amountMinor: 200000, method: 'CASH', receivedAt: new Date(), donor: p, wants80G: true })).body;
    expect((await db.receipt.findFirstOrThrow({ where: { donationId: big.id } })).kind).toBe('GENERAL');
    expect((await db.receipt.findFirstOrThrow({ where: { donationId: small.id } })).kind).toBe('SECTION_80G');
    await balanced();
  });
  it('serves the PDF only with the private link', async () => {
    const d = (await give()).body;
    await pay(d);
    const ok = await as('alpha')('get', `receipts/public/${d.donationId}?token=${d.token}`).buffer(true).parse((r: any, cb: any) => { const c: Buffer[] = []; r.on('data', (x: Buffer) => c.push(x)); r.on('end', () => cb(null, Buffer.concat(c))); });
    expect((ok.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await as('alpha')('get', `receipts/public/${d.donationId}?token=x`)).status).toBe(404);
    expect((await as('beta')('get', `receipts/public/${d.donationId}?token=${d.token}`)).status).toBe(404);
  });
});

describe('refunds', () => {
  it('never refunds more than was paid, even in parallel', async () => {
    const d = (await give()).body;
    await pay(d);
    const rs = await Promise.all(Array.from({ length: 5 }, () => admin('post', `donations/${d.donationId}/refunds`, { amountMinor: 150000, reason: 'Duplicate gift' })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    await drain();
    let row = await db.donation.findUniqueOrThrow({ where: { id: d.donationId }, include: { receipts: true } });
    expect([row.status, row.refundedMinor]).toEqual(['PARTIALLY_REFUNDED', 150000n]);
    const issued = row.receipts.filter((r) => r.status === 'ISSUED');
    expect(issued).toHaveLength(1);
    expect((issued[0].snapshot as any).donation.amountMinor).toBe(100000);
    await admin('post', `donations/${d.donationId}/refunds`, { amountMinor: 100000, reason: 'Rest of it' });
    await drain();
    row = await db.donation.findUniqueOrThrow({ where: { id: d.donationId }, include: { receipts: true } });
    expect(row.status).toBe('REFUNDED');
    expect(row.receipts.every((r) => r.status === 'VOID')).toBe(true);
    await balanced();
  });
});

describe('recurring', () => {
  it('records each charge once and lets only the owner cancel', async () => {
    const me = as('alpha', await login('asha@example.org', 'alpha'));
    const s = (await me('post', 'public/donations', { amountMinor: 50000, donor, interval: 'MONTHLY' })).body;
    expect(s.kind).toBe('subscription');
    const ev = (id: string, amount = 50000) => ({ event: 'subscription.charged', payload: { subscription: { entity: { id: s.providerSubscriptionId, charge_at: 1900000000 } }, payment: { entity: { id, order_id: 'o', amount, currency: 'INR' } } } });
    await webhook('alpha', ev('pay_s1'), 'evt_s1');
    await webhook('alpha', ev('pay_s1'), 'evt_s1_again');
    await webhook('alpha', ev('pay_s2'), 'evt_s2');
    await drain();
    expect(await db.donation.count({ where: { subscriptionId: s.subscriptionId, status: 'COMPLETED' } })).toBe(2);
    const other = as('alpha', await login('other@example.org', 'alpha'));
    expect((await other('put', `me/giving/subscriptions/${s.subscriptionId}/cancel`)).status).toBe(404);
    expect((await me('put', `me/giving/subscriptions/${s.subscriptionId}/cancel`)).body.status).toBe('CANCELLED');
  });
  it("a donor sees only their own gifts and receipts", async () => {
    const me = (await as('alpha', await login('asha@example.org', 'alpha'))('get', 'me/giving')).body;
    expect(me.total).toBeGreaterThan(5);
    const other = as('alpha', await login('other@example.org', 'alpha'));
    expect((await other('get', 'me/giving')).body.total).toBe(0);
    const rid = me.items.find((i: any) => i.receipts[0]).receipts[0].id;
    expect((await other('get', `receipts/mine/${rid}`)).status).toBe(404);
  });
});

describe('finance', () => {
  it('books settlements once and stays balanced', async () => {
    const p = await db.payment.findFirstOrThrow({ where: { provider: 'MOCK', status: 'CAPTURED', settledAt: null } });
    const csv = `payment_id,fee,settlement_id,settled_on\n${p.providerPaymentId},59.00,setl_1,2026-11-20\npay_unknown,1,setl_1,2026-11-20`;
    const a = (await admin('post', 'finance/settlements', { csv })).body;
    expect([a.settled, a.unknown]).toEqual([1, ['pay_unknown']]);
    expect((await admin('post', 'finance/settlements', { csv })).body.already).toBe(1);
    await balanced();
    expect((await admin('get', 'finance/trial-balance?from=2020-01-01&to=2100-01-01')).body.balanced).toBe(true);
  });
  it('imports donors, reporting bad rows', async () => {
    const r = (await admin('post', 'donor-tools/import', { csv: 'fullName,email,pan\nGood One,good@x.org,\nBad Pan,b@x.org,123\n' })).body;
    expect([r.created, r.errors[0].row]).toEqual([1, 3]);
  });
});
