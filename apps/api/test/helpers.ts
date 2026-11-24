import { execFileSync } from 'child_process';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { hashPassword, hmacSha256 } from '@vashundhara-foundation/auth';
import Redis from 'ioredis';
import request from 'supertest';

const url = process.env.TEST_DATABASE_URL ?? '';
if (!/test/.test(new URL(url || 'postgres://x/x').pathname)) throw new Error('TEST_DATABASE_URL must point at a database whose name contains "test"');
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: url, JWT_SECRET: 'e2e-only-'.padEnd(48, 'x'), ENCRYPTION_KEY: randomBytes(32).toString('base64'), WORKER_ENABLED: 'false', ROOT_DOMAIN: 'ngo.test', APP_URL: 'http://ngo.test', DEFAULT_TENANT_SLUG: 'alpha' });

export const db = new PrismaClient();
export let http: any;
export let jobs: any;
let app: any;
let redis: Redis;

export async function boot() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(',')} CASCADE`);
  execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { cwd: join(__dirname, '../../../packages/database'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  await redis.flushdb();
  const { AppModule } = await import('../src/app.module');
  const { configure } = await import('../src/setup');
  const { JobsService } = await import('../src/common/jobs/jobs.module');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication({ rawBody: true, logger: ['error'] });
  configure(app);
  await app.init();
  http = app.getHttpServer();
  jobs = app.get(JobsService);
}
export async function shutdown() {
  await app?.close();
  redis?.disconnect();
  await db.$disconnect();
}
export const clearLimits = () => redis.flushdb();
export async function drain() {
  // Failed jobs are retried later by design, so this always ends.
  while (await jobs.runOne()) { /* next */ }
}
export const PASSWORD = 'correct-horse-9';
let hash: string;

export async function ngo(slug: string, status: 'ACTIVE' | 'PENDING_SETUP' = 'ACTIVE') {
  const t = await db.tenant.upsert({ where: { slug }, update: { status }, create: { slug, name: slug, displayName: slug, status } });
  await db.complianceProfile.create({ data: { tenantId: t.id, legalName: `${slug} Trust`, pan: 'AAATA1234A', reg80G: `80G-${slug}` } });
  return t;
}
export async function person(email: string, tenantId: string | null, roles: string[] = [], extra: Record<string, unknown> = {}) {
  hash ??= await hashPassword(PASSWORD);
  const u = (await db.user.findUnique({ where: { email } })) ?? (await db.user.create({ data: { email, firstName: email.split('@')[0], lastName: 'Test', passwordHash: hash, emailVerified: true, status: 'ACTIVE', ...extra } }));
  if (tenantId) {
    const rs = await db.role.findMany({ where: { name: { in: roles }, tenantId: null } });
    await db.membership.create({ data: { userId: u.id, tenantId, roles: { create: rs.map((r) => ({ roleId: r.id })) } } });
  }
  return u;
}
export async function login(email: string, slug: string): Promise<string> {
  const r = await request(http).post('/api/v1/auth/login').set('x-vf-host', `${slug}.ngo.test`).send({ email, password: PASSWORD });
  if (!r.body.accessToken) throw new Error(`login failed: ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
}
type Method = 'get' | 'post' | 'put' | 'delete';
export const as = (slug: string, token?: string) => (method: Method, path: string, body?: unknown) => {
  let r = request(http)[method](`/api/v1/${path}`).set('x-vf-host', `${slug}.ngo.test`);
  if (token) r = r.set('authorization', `Bearer ${token}`);
  return body === undefined ? r : r.send(body as object);
};
/** Reads a one-time link from the most recent email to this address. */
export async function mailToken(to: string): Promise<string> {
  const n = await db.notification.findFirst({ where: { recipient: to }, orderBy: { createdAt: 'desc' } });
  return /token=([\w-]+)/.exec(n?.content ?? '')?.[1] ?? '';
}
export const SECRETS = { keyId: 'mock_key', keySecret: 'mock-secret-value', webhookSecret: 'mock-webhook-secret' };
export const sign = (orderId: string, paymentId: string) => hmacSha256(`${orderId}|${paymentId}`, SECRETS.keySecret);
export async function webhook(slug: string, event: unknown, eventId: string, secret = SECRETS.webhookSecret) {
  const raw = JSON.stringify(event);
  return request(http).post(`/api/v1/payments/mock/webhook/${slug}`).set('content-type', 'application/json').set('x-razorpay-event-id', eventId).set('x-razorpay-signature', hmacSha256(raw, secret)).send(raw);
}
