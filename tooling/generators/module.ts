#!/usr/bin/env ts-node
/**
 * Module Generator for Vashundhara Foundation API
 * Usage: pnpm generate:module --name=billing
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')

interface ModuleOptions {
  name: string
  description?: string
  hasController?: boolean
  hasService?: boolean
  hasDto?: boolean
  hasEntity?: boolean
  hasRepository?: boolean
  hasGuard?: boolean
  hasInterceptor?: boolean
}

const TEMPLATES = {
  module: (name: string, className: string) => `/**
 * ${className} Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';
import { ${className}Controller } from './${name}.controller';
import { ${className}Service } from './${name}.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [${className}Controller],
  providers: [${className}Service],
  exports: [${className}Service]
})
export class ${className}Module {}`,

  controller: (name: string, className: string) => `/**
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
import { ${className}Service } from './${name}.service';
import { Create${className}Dto, Update${className}Dto, ${className}QueryDto } from './dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Permissions } from '../../decorators/permissions.decorator';

@ApiTags('${className}')
@ApiBearerAuth()
@Controller('${name}')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ${className}Controller {
  constructor(private readonly ${name.toLowerCase()}Service: ${className}Service) {}

  @Post()
  @Roles('tenant_admin', 'manager')
  @Permissions('${name}:create')
  @ApiOperation({ summary: 'Create ${name}' })
  async create(@Body() dto: Create${className}Dto) {
    return this.${name.toLowerCase()}Service.create(dto);
  }

  @Get()
  @Roles('tenant_admin', 'manager', 'member', 'viewer')
  @Permissions('${name}:read')
  @ApiOperation({ summary: 'List ${name}s' })
  async findAll(@Query() query: ${className}QueryDto) {
    return this.${name.toLowerCase()}Service.findAll(query);
  }

  @Get(':id')
  @Roles('tenant_admin', 'manager', 'member', 'viewer')
  @Permissions('${name}:read')
  @ApiOperation({ summary: 'Get ${name} by ID' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.${name.toLowerCase()}Service.findById(id);
  }

  @Put(':id')
  @Roles('tenant_admin', 'manager')
  @Permissions('${name}:update')
  @ApiOperation({ summary: 'Update ${name}' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Update${className}Dto
  ) {
    return this.${name.toLowerCase()}Service.update(id, dto);
  }

  @Delete(':id')
  @Roles('tenant_admin')
  @Permissions('${name}:delete')
  @ApiOperation({ summary: 'Delete ${name}' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.${name.toLowerCase()}Service.delete(id);
  }
}`,

  service: (name: string, className: string) => `/**
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

    const result = await this.prisma.${name.toLowerCase()}.create({ data });

    await this.invalidateCache();
    return result;
  }

  async findAll(params: any) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(tenantId && { tenantId })
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.${name.toLowerCase()}.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      this.prisma.${name.toLowerCase()}.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;

    const result = await this.prisma.${name.toLowerCase()}.findUnique({
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

    const result = await this.prisma.${name.toLowerCase()}.update({
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

    await this.prisma.${name.toLowerCase()}.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await this.invalidateCache(id);
    return { success: true };
  }

  private async invalidateCache(id?: string) {
    if (id) {
      await this.redis.del(\`${name.toLowerCase()}:\${id}\`);
    } else {
      await this.redis.delPattern(\`${name.toLowerCase()}:*\`);
    }
  }
}`,

  dto: (name: string, className: string) => `/**
 * ${className} DTOs for Vashundhara Foundation API
 */

import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { extendApi } from '@anatine/zod-openapi';

// Base schema
const ${name.toLowerCase()}BaseSchema = z.object({
  name: z.string().min(1).max(255).openapi({ example: 'Sample ${className}' }),
  description: z.string().optional().openapi({ example: 'Description of the ${name.toLowerCase()}' }),
  metadata: z.record(z.unknown()).optional()
});

// Create DTO
export const Create${className}Schema = ${name.toLowerCase()}BaseSchema;
export class Create${className}Dto extends createZodDto(extendApi(Create${className}Schema)) {}

// Update DTO
export const Update${className}Schema = ${name.toLowerCase()}BaseSchema.partial();
export class Update${className}Dto extends createZodDto(extendApi(Update${className}Schema)) {}

// Query DTO
export const ${className}QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});
export class ${className}QueryDto extends createZodDto(extendApi(${className}QuerySchema)) {}

// Response DTO
export const ${className}ResponseSchema = ${name.toLowerCase()}BaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export class ${className}ResponseDto extends createZodDto(extendApi(${className}ResponseSchema)) {}`,

  entity: (name: string, className: string) => `// Add to packages/database/prisma/schema.prisma

model ${className} {
  id        String   @id @default(uuid())
  name      String
  description String?
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  // Multi-tenancy
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("${name.toLowerCase()}s")
}`,

  index: (name: string, className: string) => `export * from './${name}.module';
export * from './${name}.controller';
export * from './${name}.service';
export * from './dto';`
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

async function generateModule(options: ModuleOptions) {
  const { name, hasController = true, hasService = true, hasDto = true, hasEntity = true } = options
  const className = toPascalCase(name)
  const modulePath = join(__dirname, '..', '..', 'apps', 'api', 'src', 'modules', name.toLowerCase())

  console.log(`Generating module: ${className} at ${modulePath}`)

  // Create directory structure
  const dirs = [
    modulePath,
    join(modulePath, 'controllers'),
    join(modulePath, 'services'),
    join(modulePath, 'dto'),
    join(modulePath, 'entities'),
    join(modulePath, 'repositories'),
    join(modulePath, 'guards'),
    join(modulePath, 'interceptors')
  ]

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }

  // Write files
  await fs.writeFile(join(modulePath, `${name.toLowerCase()}.module.ts`), TEMPLATES.module(name, className))

  if (hasController) {
    await fs.writeFile(join(modulePath, 'controllers', `${name.toLowerCase()}.controller.ts`), TEMPLATES.controller(name, className))
  }

  if (hasService) {
    await fs.writeFile(join(modulePath, 'services', `${name.toLowerCase()}.service.ts`), TEMPLATES.service(name, className))
  }

  if (hasDto) {
    await fs.writeFile(join(modulePath, 'dto', 'index.ts'), TEMPLATES.dto(name, className))
  }

  if (hasEntity) {
    await fs.writeFile(join(modulePath, 'entities', `${name.toLowerCase()}.entity.ts`), TEMPLATES.entity(name, className))
  }

  await fs.writeFile(join(modulePath, 'index.ts'), TEMPLATES.index(name, className))

  console.log(`
✅ Module "${className}" generated successfully!

Files created:
- ${modulePath}/${name.toLowerCase()}.module.ts
${hasController ? `- ${modulePath}/controllers/${name.toLowerCase()}.controller.ts` : ''}
${hasService ? `- ${modulePath}/services/${name.toLowerCase()}.service.ts` : ''}
${hasDto ? `- ${modulePath}/dto/index.ts` : ''}
${hasEntity ? `- ${modulePath}/entities/${name.toLowerCase()}.entity.ts` : ''}
- ${modulePath}/index.ts

Next steps:
1. Add the Prisma model to packages/database/prisma/schema.prisma (see entities/${name.toLowerCase()}.entity.ts)
2. Run: pnpm db:migrate:create --name=add_${name.toLowerCase()}
3. Run: pnpm db:generate
4. Register the module in apps/api/src/app.module.ts
5. Add tRPC routes in apps/api/src/trpc/routers/${name.toLowerCase()}.ts
`)

  // Print entity schema for copy-paste
  console.log('\n📋 Prisma Model (copy to schema.prisma):')
  console.log(TEMPLATES.entity(name, className))
}

// CLI parsing
const args = process.argv.slice(2)
const options: ModuleOptions = {
  name: '',
  hasController: true,
  hasService: true,
  hasDto: true,
  hasEntity: true
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--name' || arg === '-n') {
    options.name = args[++i]
  } else if (arg === '--no-controller') {
    options.hasController = false
  } else if (arg === '--no-service') {
    options.hasService = false
  } else if (arg === '--no-dto') {
    options.hasDto = false
  } else if (arg === '--no-entity') {
    options.hasEntity = false
  }
}

if (!options.name) {
  console.error('Usage: pnpm generate:module --name=<module-name> [options]')
  console.error('Options:')
  console.error('  --name, -n          Module name (required)')
  console.error('  --no-controller     Skip controller generation')
  console.error('  --no-service        Skip service generation')
  console.error('  --no-dto            Skip DTO generation')
  console.error('  --no-entity         Skip entity generation')
  process.exit(1)
}

generateModule(options).catch(console.error)