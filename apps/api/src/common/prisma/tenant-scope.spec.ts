import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { scopeArgs, TENANT_MODELS, TenantScopeError } from './tenant-scope';

const A = { tenantId: 'a' };
describe('tenant scope', () => {
  it('covers every model that carries a tenantId, apart from named infrastructure', () => {
    for (const m of Prisma.dmmf.datamodel.models) {
      const has = m.fields.some((f) => f.name === 'tenantId');
      if (has && !['Session', 'Job'].includes(m.name)) expect(TENANT_MODELS.has(m.name), m.name).toBe(true);
    }
  });
  it('fails closed without an organisation', () => {
    for (const op of ['findMany', 'create', 'update', 'deleteMany', 'count', 'aggregate', 'groupBy']) expect(() => scopeArgs('Donor', op, { data: {} }, {})).toThrow(TenantScopeError);
  });
  it('adds the filter to every read, even when the caller passes another tenant', () => {
    for (const op of ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'])
      expect(scopeArgs('Donor', op, { where: { tenantId: 'b' } }, A).where).toEqual({ tenantId: 'b', AND: [{ tenantId: 'a' }] });
  });
  it('keeps existing AND and OR conditions', () => {
    expect(scopeArgs('Donor', 'findMany', { where: { OR: [{ id: '1' }], AND: { id: '2' } } }, A).where).toEqual({ OR: [{ id: '1' }], AND: [{ id: '2' }, { tenantId: 'a' }] });
  });
  it('stamps creates and refuses to move rows', () => {
    expect(scopeArgs('Donor', 'create', { data: { tenantId: 'b', x: 1 } }, A).data).toEqual({ tenantId: 'a', x: 1 });
    expect(scopeArgs('Donor', 'createMany', { data: [{ x: 1 }] }, A).data).toEqual([{ x: 1, tenantId: 'a' }]);
    expect(() => scopeArgs('Donor', 'create', { data: { tenant: { connect: { id: 'b' } } } }, A)).toThrow();
    expect(() => scopeArgs('Donor', 'update', { where: { id: '1' }, data: { tenantId: 'b' } }, A)).toThrow();
    expect(() => scopeArgs('Donor', 'upsert', { where: {}, create: {}, update: { tenantId: 'b' } }, A)).toThrow();
  });
  it('lets NGOs read shared rows but never write them', () => {
    expect(scopeArgs('Role', 'findMany', {}, A).where.AND).toEqual([{ OR: [{ tenantId: 'a' }, { tenantId: null }] }]);
    expect(scopeArgs('Role', 'updateMany', { data: {} }, A).where.AND).toEqual([{ tenantId: 'a' }]);
  });
  it('refuses unknown operations', () => expect(() => scopeArgs('Donor', 'findRaw', {}, A)).toThrow());
});
