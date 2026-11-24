#!/usr/bin/env ts-node
/**
 * CRUD Generator for Vashundhara Foundation API
 * Usage: pnpm generate:crud --entity=Invoice --module=billing
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')

interface CrudOptions {
  entity: string
  module: string
  fields?: string
  relations?: string
}

const TEMPLATES = {
  service: (entity: string, module: string, className: string, moduleClassName: string, fields: string[]) => `/**
 * ${className} Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

@Injectable()
export class ${className}Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  async create(data: any) {
    const context = this.tenantContext.getContext();

    if (!context?.isSystemAdmin && !context?.isTenantAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Add tenant ID if not system admin
    if (!context?.isSystemAdmin) {
      data.tenantId = context.tenantId;
    }

    const result = await this.prisma.${entity.toLowerCase()}.create({ data });

    await this.invalidateCache();
    return result;
  }

  async findAll(params: any) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(tenantId && { tenantId })
    };

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        where[key] = value;
      }
    });

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.${entity.toLowerCase()}.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      this.prisma.${entity.toLowerCase()}.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    const result = await this.prisma.${entity.toLowerCase()}.findUnique({
      where: { id, deletedAt: null, ...(tenantId && { tenantId }) }
    });

    if (!result) {
      throw new NotFoundException('${className} not found');
    }

    return result;
  }

  async update(id: string, data: any) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    await this.findById(id);

    const result = await this.prisma.${entity.toLowerCase()}.update({
      where: { id },
      data
    });

    await this.invalidateCache(id);
    return result;
  }

  async delete(id: string) {
    const context = this.tenantContext.getContext();

    if (!context?.isSystemAdmin && !context?.isTenantAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.findById(id);

    await this.prisma.${entity.toLowerCase()}.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.invalidateCache(id);
    return { success: true };
  }

  private async invalidateCache(id?: string) {
    if (id) {
      await this.redis.del(\`${entity.toLowerCase()}:\${id}\`);
    } else {
      await this.redis.delPattern(\`${entity.toLowerCase()}:*\`);
    }
  }
}`,

  controller: (entity: string, module: string, className: string, moduleClassName: string, fields: string[]) => `/**
 * ${className} Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ${className}Service } from './${entity.toLowerCase()}.service';
import { Create${className}Dto, Update${className}Dto, ${className}QueryDto } from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Permissions } from '../../decorators/permissions.decorator';

@ApiTags('${className}')
@ApiBearerAuth()
@Controller('${entity.toLowerCase()}')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ${className}Controller {
  constructor(private readonly ${entity.toLowerCase()}Service: ${className}Service) {}

  @Post()
  @Roles('tenant_admin', 'manager')
  @Permissions('${entity.toLowerCase()}:create')
  @ApiOperation({ summary: 'Create ${entity.toLowerCase()}' })
  async create(@Body() dto: Create${className}Dto) {
    return this.${entity.toLowerCase()}Service.create(dto);
  }

  @Get()
  @Roles('tenant_admin', 'manager', 'member', 'viewer')
  @Permissions('${entity.toLowerCase()}:read')
  @ApiOperation({ summary: 'List ${entity.toLowerCase()}s' })
  async findAll(@Query() query: ${className}QueryDto) {
    return this.${entity.toLowerCase()}Service.findAll(query);
  }

  @Get(':id')
  @Roles('tenant_admin', 'manager', 'member', 'viewer')
  @Permissions('${entity.toLowerCase()}:read')
  @ApiOperation({ summary: 'Get ${entity.toLowerCase()} by ID' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.${entity.toLowerCase()}Service.findById(id);
  }

  @Put(':id')
  @Roles('tenant_admin', 'manager')
  @Permissions('${entity.toLowerCase()}:update')
  @ApiOperation({ summary: 'Update ${entity.toLowerCase()}' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update${className}Dto
  ) {
    return this.${entity.toLowerCase()}Service.update(id, dto);
  }

  @Delete(':id')
  @Roles('tenant_admin')
  @Permissions('${entity.toLowerCase()}:delete')
  @ApiOperation({ summary: 'Delete ${entity.toLowerCase()}' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.${entity.toLowerCase()}Service.delete(id);
  }
}`,

  dto: (entity: string, className: string, fields: string[]) => `/**
 * ${className} DTOs for Vashundhara Foundation API
 */

import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { extendApi } from '@anatine/zod-openapi';

${fields.map(f => {
  const [name, type] = f.split(':');
  const tsType = type === 'string' ? 'z.string()' :
                 type === 'number' ? 'z.number()' :
                 type === 'boolean' ? 'z.boolean()' :
                 type === 'date' ? 'z.date()' : 'z.string()';
  return `const ${name}Schema = ${tsType}.openapi({ example: '${name}' });`;
}).join('\n')}

// Base schema with all fields
const ${entity.toLowerCase()}BaseSchema = z.object({
${fields.map(f => {
  const [name, type] = f.split(':');
  const tsType = type === 'string' ? 'z.string()' :
                 type === 'number' ? 'z.number()' :
                 type === 'boolean' ? 'z.boolean()' :
                 type === 'date' ? 'z.date()' : 'z.string()';
  return `  ${name}: ${tsType},`;
}).join('\n')}
});

// Create DTO (all fields required except auto-generated)
export const Create${className}Schema = ${entity.toLowerCase()}BaseSchema.omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, tenantId: true });
export class Create${className}Dto extends createZodDto(extendApi(Create${className}Schema)) {}

// Update DTO (all fields optional)
export const Update${className}Schema = ${entity.toLowerCase()}BaseSchema.omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, tenantId: true }).partial();
export class Update${className}Dto extends createZodDto(extendApi(Update${className}Schema)) {}

// Query DTO
export const ${className}QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
${fields.map(f => {
  const [name, type] = f.split(':');
  const tsType = type === 'string' ? 'z.string().optional()' :
                 type === 'number' ? 'z.coerce.number().optional()' :
                 type === 'boolean' ? 'z.coerce.boolean().optional()' :
                 type === 'date' ? 'z.coerce.date().optional()' : 'z.string().optional()';
  return `  ${name}: ${tsType},`;
}).join('\n')}
});
export class ${className}QueryDto extends createZodDto(extendApi(${className}QuerySchema)) {}

// Response DTO
export const ${className}ResponseSchema = ${entity.toLowerCase()}BaseSchema;
export class ${className}ResponseDto extends createZodDto(extendApi(${className}ResponseSchema)) {}`,

  prismaModel: (entity: string, className: string, fields: string[]) => `model ${className} {
  id        String   @id @default(uuid())
${fields.map(f => {
  const [name, type] = f.split(':');
  const prismaType = type === 'string' ? 'String' :
                     type === 'number' ? 'Float' :
                     type === 'boolean' ? 'Boolean' :
                     type === 'date' ? 'DateTime' : 'String';
  return `  ${name}      ${prismaType}`;
}).join('\n')}
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  // Multi-tenancy
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("${entity.toLowerCase()}s")
}`
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function parseFields(fieldsStr: string): string[] {
  if (!fieldsStr) return ['name:String', 'description:String?']
  return fieldsStr.split(',').map(f => f.trim())
}

async function generateCrud(options: CrudOptions) {
  const { entity, module, fields: fieldsStr } = options
  const className = toPascalCase(entity)
  const moduleClassName = toPascalCase(module)
  const fields = parseFields(fieldsStr || '')
  const modulePath = join(__dirname, '..', '..', 'apps', 'api', 'src', 'modules', module.toLowerCase())
  const entityPath = join(modulePath, entity.toLowerCase())

  console.log(`Generating CRUD for ${className} in module ${moduleClassName}`)

  // Create directory
  await fs.mkdir(entityPath, { recursive: true })

  // Write files
  await fs.writeFile(join(entityPath, `${entity.toLowerCase()}.service.ts`), TEMPLATES.service(entity, module, className, moduleClassName, fields))
  await fs.writeFile(join(entityPath, `${entity.toLowerCase()}.controller.ts`), TEMPLATES.controller(entity, module, className, moduleClassName, fields))
  await fs.writeFile(join(entityPath, 'dto.ts'), TEMPLATES.dto(entity, className, fields))

  console.log(`
✅ CRUD for "${className}" generated successfully!

Files created:
- ${entityPath}/${entity.toLowerCase()}.service.ts
- ${entityPath}/${entity.toLowerCase()}.controller.ts
- ${entityPath}/dto.ts

Next steps:
1. Add the Prisma model to packages/database/prisma/schema.prisma:
${TEMPLATES.prismaModel(entity, className, fields).split('\n').map(l => '   ' + l).join('\n')}

2. Run: pnpm db:migrate:create --name=add_${entity.toLowerCase()}
3. Run: pnpm db:generate
4. Register controller/service in ${modulePath}/${module.toLowerCase()}.module.ts
5. Add tRPC routes in apps/api/src/trpc/routers/${module.toLowerCase()}.ts
`)
}

// CLI parsing
const args = process.argv.slice(2)
const options: CrudOptions = {
  entity: '',
  module: '',
  fields: ''
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--entity' || arg === '-e') {
    options.entity = args[++i]
  } else if (arg === '--module' || arg === '-m') {
    options.module = args[++i]
  } else if (arg === '--fields' || arg === '-f') {
    options.fields = args[++i]
  }
}

if (!options.entity || !options.module) {
  console.error('Usage: pnpm generate:crud --entity=<EntityName> --module=<ModuleName> [--fields="name:string,amount:number,active:boolean"]')
  console.error('Options:')
  console.error('  --entity, -e    Entity name (required)')
  console.error('  --module, -m    Module name (required)')
  console.error('  --fields, -f    Comma-separated fields (optional)')
  process.exit(1)
}

generateCrud(options).catch(console.error)