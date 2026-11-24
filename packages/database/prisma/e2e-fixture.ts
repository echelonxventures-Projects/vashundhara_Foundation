import { execFileSync } from 'child_process';
import { FieldCipher, hashPassword } from '@vashundhara-foundation/auth';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
if (!/test/.test(new URL(url).pathname)) throw new Error('Refusing to reset a database that is not a test database');
const db = new PrismaClient();
async function main() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(',')} CASCADE`);
  execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { env: process.env, stdio: 'pipe' });
  const t = await db.tenant.update({ where: { slug: 'vashundhara' }, data: { status: 'ACTIVE', supportedLocales: ['en', 'hi', 'ur'], settings: { tagline: 'Every child in school', contactEmail: 'hello@example.org' } } });
  await db.complianceProfile.create({ data: { tenantId: t.id, legalName: 'Test Trust', pan: 'AAATT1234A', reg80G: '80G/TEST/1', registrationNo: 'R-1' } });
  const c = new FieldCipher(Buffer.alloc(32, 7).toString('base64'));
  const aad = `pay:${t.id}:MOCK:DOMESTIC`;
  await db.paymentAccount.create({ data: { tenantId: t.id, provider: 'MOCK', fund: 'DOMESTIC', keyId: 'mock', keySecretEnc: c.encrypt('mock-secret-value', aad), webhookSecretEnc: c.encrypt('mock-webhook-secret', aad) } });
  const passwordHash = await hashPassword('correct-horse-9');
  for (const [email, role] of [['admin@example.org', 'tenant_admin'], ['donor@example.org', 'donor'], ['field@example.org', 'field_worker']]) {
    const r = await db.role.findFirstOrThrow({ where: { name: role, tenantId: null } });
    await db.user.create({ data: { email, firstName: role.split('_')[0], lastName: 'Test', passwordHash, emailVerified: true, status: 'ACTIVE', memberships: { create: { tenantId: t.id, roles: { create: { roleId: r.id } } } } } });
  }
  await db.user.create({ data: { email: 'root@example.org', firstName: 'Root', lastName: 'Test', passwordHash, emailVerified: true, status: 'ACTIVE', isSystemAdmin: true } });
  await db.campaign.create({ data: { tenantId: t.id, slug: 'school-kits', title: 'School kits', summary: 'Books and bags', story: '## Why\n\nHello <script>window.__xss=1</script>', goalMinor: 10_000_000, status: 'ACTIVE' } });
  await db.event.create({ data: { tenantId: t.id, slug: 'tree-day', title: 'Tree day', startsAt: new Date(Date.now() + 864e5), endsAt: new Date(Date.now() + 9e7), capacity: 5, status: 'PUBLISHED' } });
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
