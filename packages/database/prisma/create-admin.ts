import { hashPassword, passwordProblems } from '@vashundhara-foundation/auth';
import { PrismaClient } from '@prisma/client';

/** ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm db:create-admin — the password is read from the environment so it never appears in the process list. */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const slug = process.env.DEFAULT_TENANT_SLUG ?? 'vashundhara';
  if (!email?.includes('@')) throw new Error('Set ADMIN_EMAIL');
  const problems = passwordProblems(password);
  if (problems.length) throw new Error(`ADMIN_PASSWORD: ${problems.join('. ')}`);
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    const role = await prisma.role.findFirstOrThrow({ where: { name: 'tenant_admin', tenantId: null } });
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) throw new Error('That email already has an account; refusing to change it');
      const u = await tx.user.create({ data: { email, firstName: 'Platform', lastName: 'Admin', passwordHash: await hashPassword(password), emailVerified: true, status: 'ACTIVE', isSystemAdmin: true } });
      const m = await tx.membership.create({ data: { userId: u.id, tenantId: tenant.id } });
      await tx.membershipRole.create({ data: { membershipId: m.id, roleId: role.id } });
      await tx.auditLog.create({ data: { action: 'CREATE', resource: 'systemAdmin', resourceId: u.id, metadata: { via: 'create-admin' } } });
    });
    console.log(`Created ${email}. Sign in and turn on two-step verification.`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error((e as Error).message); process.exitCode = 1; });
