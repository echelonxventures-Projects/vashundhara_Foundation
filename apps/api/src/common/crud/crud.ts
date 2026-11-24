import { Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Type } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Permission, Resource } from '@vashundhara-foundation/shared';
import { Prisma } from '@prisma/client';
import { z, ZodObject } from 'zod';
import { AuditService } from '../audit/audit.service';
import { getCtx, UserInfo } from '../context/context';
import { Can, PageQuery, Paging, ZBody, ZQuery } from '../http/decorators';
import { PrismaService } from '../prisma/prisma.module';

type Row = Record<string, any>;
export interface CrudOptions {
  path: string;
  resource: Resource;
  model: string;
  schema: ZodObject;
  search?: string[];
  filters?: string[];
  sort?: string[];
  defaultSort?: Row;
  include?: Row;
  omit?: Row;
  only?: ('list' | 'get' | 'create' | 'update' | 'delete')[];
  /** Adjust or reject data before it is saved. */
  prepare?: (data: Row, ctx: { prisma: PrismaService; user: UserInfo; existing: Row | null }) => Promise<Row> | Row;
  after?: (row: Row, ctx: { prisma: PrismaService; created: boolean }) => Promise<void>;
}

const modelMeta = (name: string) => Prisma.dmmf.datamodel.models.find((m) => m.name.toLowerCase() === name.toLowerCase())!;

/** Builds a tenant-scoped, permission-checked, audited REST controller for one model. */
export function crudController(o: CrudOptions): Type {
  const meta = modelMeta(o.model);
  if (!meta?.fields.some((f) => f.name === 'tenantId')) throw new Error(`${o.model} is not tenant-scoped`);
  // Zod applies defaults inside partial(), which would reset fields on update. Use database defaults.
  for (const [k, v] of Object.entries(o.schema.shape)) if (v instanceof z.ZodDefault) throw new Error(`${o.path}.${k} must not use .default()`);
  const soft = meta.fields.some((f) => f.name === 'deletedAt');
  const has = (a: NonNullable<CrudOptions['only']>[number]) => !o.only || o.only.includes(a);
  const can = (a: string) => Can(`${o.resource}:${a}` as Permission);
  const sortable = new Set([...(o.sort ?? []), 'createdAt']);
  const fieldType = (f: string) => meta.fields.find((x) => x.name === f);

  @ApiTags(o.path)
  @ApiBearerAuth()
  @Controller(o.path)
  class Crud {
    constructor(readonly prisma: PrismaService, readonly audit: AuditService) {}
    get db(): any { return (this.prisma as any)[o.model]; }
    live(where: Row = {}) { return soft ? { ...where, deletedAt: null } : where; }
    shape() { return { ...(o.include ? { include: o.include } : {}), ...(o.omit ? { omit: o.omit } : {}) }; }

    async list(page: Paging, query: Row) {
      const where = this.live();
      for (const f of o.filters ?? []) {
        const raw = query[f];
        if (typeof raw !== 'string' || raw === '') continue;
        const t = fieldType(f);
        if (t?.kind === 'enum') {
          const values = Prisma.dmmf.datamodel.enums.find((e) => e.name === t.type)!.values.map((v) => v.name);
          if (!values.includes(raw)) continue;
        }
        where[f] = t?.type === 'Boolean' ? raw === 'true' : t?.isList ? { has: raw } : raw;
      }
      if (page.q && o.search?.length) where.OR = o.search.map((f) => ({ [f]: { contains: page.q, mode: 'insensitive' } }));
      const desc = page.sort?.startsWith('-');
      const key = page.sort?.replace(/^-/, '');
      const orderBy = key && sortable.has(key) ? { [key]: desc ? 'desc' : 'asc' } : o.defaultSort ?? { createdAt: 'desc' };
      const [items, total] = await Promise.all([
        this.db.findMany({ where, orderBy, skip: (page.page - 1) * page.limit, take: page.limit, ...this.shape() }),
        this.db.count({ where })
      ]);
      return { items, total, page: page.page, limit: page.limit };
    }
    async get(id: string) {
      const row = await this.db.findFirst({ where: this.live({ id }), ...this.shape() });
      if (!row) throw new NotFoundException('Not found');
      return row;
    }
    async create(body: Row) {
      const data = o.prepare ? await o.prepare(body, { prisma: this.prisma, user: getCtx()!.user!, existing: null }) : body;
      const row = await this.db.create({ data, ...this.shape() });
      await this.audit.log('CREATE', o.model, row.id, undefined, row);
      await o.after?.(row, { prisma: this.prisma, created: true });
      return row;
    }
    async update(id: string, body: Row) {
      const existing = await this.get(id);
      const data = o.prepare ? await o.prepare(body, { prisma: this.prisma, user: getCtx()!.user!, existing }) : body;
      const row = await this.db.update({ where: { id }, data, ...this.shape() });
      await this.audit.log('UPDATE', o.model, id, existing, row);
      await o.after?.(row, { prisma: this.prisma, created: false });
      return row;
    }
    async remove(id: string) {
      const existing = await this.get(id);
      if (soft) await this.db.update({ where: { id }, data: { deletedAt: new Date() } });
      else await this.db.delete({ where: { id } });
      await this.audit.log('DELETE', o.model, id, existing);
      return { ok: true };
    }
  }

  const deco = (name: string, method: MethodDecorator, perm: MethodDecorator, params: ParameterDecorator[]) => {
    const d = Object.getOwnPropertyDescriptor(Crud.prototype, name)!;
    Reflect.defineMetadata('design:paramtypes', params.map(() => Object), Crud.prototype, name);
    params.forEach((p, i) => p(Crud.prototype, name, i));
    method(Crud.prototype, name, d);
    perm(Crud.prototype, name, d);
  };
  if (has('list')) deco('list', Get(), can('read'), [ZQuery(PageQuery), Query()]);
  if (has('get')) deco('get', Get(':id'), can('read'), [Param('id')]);
  if (has('create')) deco('create', Post(), can('create'), [ZBody(o.schema.strict())]);
  if (has('update')) deco('update', Put(':id'), can('update'), [Param('id'), ZBody(o.schema.partial().strict())]);
  if (has('delete')) deco('remove', Delete(':id'), can('delete'), [Param('id')]);
  Reflect.defineMetadata('design:paramtypes', [PrismaService, AuditService], Crud);
  Object.defineProperty(Crud, 'name', { value: `${o.path.replace(/\W+(\w)/g, (_, c: string) => c.toUpperCase())}Controller` });
  return Crud;
}
