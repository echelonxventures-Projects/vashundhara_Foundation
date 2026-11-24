import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/** pnpm generate:module <name>  creates a permission-checked, tenant-scoped, audited module for an existing Prisma model. */
const name = process.argv[2] ?? '';
if (!/^[a-z][a-zA-Z]{2,39}$/.test(name)) throw new Error('Give a camelCase Prisma model name, for example: inventoryItem');
const Pascal = name[0].toUpperCase() + name.slice(1);
const path = `${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}s`;
const dir = join(process.cwd(), 'apps/api/src/modules', path);
if (existsSync(dir)) throw new Error(`${dir} already exists`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${path}.module.ts`), `import { Module } from '@nestjs/common';
import { z } from 'zod';
import { crudController } from '../../common/crud/crud';

const ${Pascal}Controller = crudController({
  path: '${path}', resource: '${path.replace(/-/g, '_')}', model: '${name}', search: [],
  schema: z.object({})
});

@Module({ controllers: [${Pascal}Controller] })
export class ${Pascal}Module {}
`);
console.log(`Created ${dir}
Next: add '${path.replace(/-/g, '_')}' to packages/shared/src/permissions.ts, fill in the schema, import ${Pascal}Module in app.module.ts,
and if you added a table, end its migration with: CALL install_tenant_checks();`);
