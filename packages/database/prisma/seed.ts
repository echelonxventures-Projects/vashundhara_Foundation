import { PermissionAction, Prisma, PrismaClient } from '@prisma/client';
import { CURRENCIES, RESOURCES, ROLE_TEMPLATES } from '@vashundhara-foundation/shared';

const prisma = new PrismaClient();

/** Safe to run on every deploy: adds or updates reference data only. */
async function main() {
  for (const [resource, actions] of Object.entries(RESOURCES)) {
    for (const a of actions) {
      const action = a.toUpperCase() as PermissionAction;
      await prisma.permission.upsert({ where: { resource_action: { resource, action } }, update: {}, create: { resource, action } });
    }
  }
  const perms = new Map((await prisma.permission.findMany()).map((p) => [`${p.resource}:${p.action.toLowerCase()}`, p.id]));
  for (const t of ROLE_TEMPLATES) {
    const existing = await prisma.role.findFirst({ where: { name: t.name, tenantId: null } });
    const data = { displayName: t.displayName, scope: t.scope, priority: t.priority, isSystem: true };
    const role = existing ? await prisma.role.update({ where: { id: existing.id }, data }) : await prisma.role.create({ data: { name: t.name, ...data } });
    const ids = t.permissions.map((p) => perms.get(p)!);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: ids } } });
    await prisma.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: role.id, permissionId })), skipDuplicates: true });
  }

  for (const [code, c] of Object.entries(CURRENCIES)) {
    const data = { symbol: c.symbol, decimals: c.decimals, name: c.name, namePlural: `${c.name}s`, isBase: code === 'USD' };
    await prisma.currency.upsert({ where: { code: code as never }, update: data, create: { code: code as never, ...data } });
  }
  const locales: [string, string, string][] = [['en', 'English', 'English'], ['hi', 'Hindi', 'हिन्दी'], ['bn', 'Bengali', 'বাংলা'], ['ta', 'Tamil', 'தமிழ்'], ['te', 'Telugu', 'తెలుగు'], ['mr', 'Marathi', 'मराठी'], ['gu', 'Gujarati', 'ગુજરાતી'], ['kn', 'Kannada', 'ಕನ್ನಡ'], ['ml', 'Malayalam', 'മലയാളം'], ['or', 'Odia', 'ଓଡ଼ିଆ'], ['pa', 'Punjabi', 'ਪੰਜਾਬੀ'], ['as', 'Assamese', 'অসমীয়া'], ['ur', 'Urdu', 'اردو']];
  for (const [i, [code, name, nativeName]] of locales.entries()) {
    const data = { name, nativeName, rtl: code === 'ur', sortOrder: i, isSystem: true };
    await prisma.locale.upsert({ where: { code: code as never }, update: data, create: { code: code as never, ...data } });
  }
  const flags: [string, string][] = [['module.volunteering', 'Volunteering'], ['module.beneficiaries', 'Beneficiary services'], ['module.learning', 'Online learning'], ['module.library', 'Digital library'], ['module.events', 'Events'], ['module.social', 'Social media planner'], ['module.csr', 'CSR and grants'], ['module.field', 'Field work']];
  for (const [key, name] of flags) {
    if (!(await prisma.featureFlag.findFirst({ where: { key, tenantId: null } }))) {
      await prisma.featureFlag.create({ data: { key, name, type: 'BOOLEAN', defaultValue: true as Prisma.InputJsonValue, isEnabled: true, rolloutPercentage: 100 } });
    }
  }
  const slug = process.env.DEFAULT_TENANT_SLUG ?? 'vashundhara';
  await prisma.tenant.upsert({
    where: { slug }, update: {},
    create: { slug, name: 'Vashundhara Foundation', displayName: 'Vashundhara Foundation', status: 'PENDING_SETUP', supportedLocales: ['en', 'hi'] }
  });
  console.log('Reference data is up to date');
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
