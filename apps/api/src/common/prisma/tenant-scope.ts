import { Prisma } from '@prisma/client';
import { getCtx } from '../context/context';

type Mode = 'strict' | 'shared';

/** Rows with tenantId = null are visible to every NGO but only editable by the platform. */
const SHARED = new Set(['Role', 'FeatureFlag', 'Translation', 'Currency', 'ExchangeRate', 'NotificationTemplate']);
/** Carry a tenantId but are infrastructure, not NGO data. */
const EXEMPT = new Set(['Session', 'Job']);

export const TENANT_MODELS: Map<string, Mode> = new Map(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'tenantId') && !EXEMPT.has(m.name))
    .map((m) => [m.name, SHARED.has(m.name) ? 'shared' : 'strict'])
);

const READ = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const CREATE = new Set(['create', 'createMany', 'createManyAndReturn']);
const WRITE = new Set(['update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany']);

type Any = Record<string, any>;
const and = (where: Any | undefined, clause: Any): Any => {
  const w = where ?? {};
  const existing = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...existing, clause] };
};

export class TenantScopeError extends Error {}

/** Pure so it can be unit tested. Returns the arguments Prisma should run with. */
export function scopeArgs(model: string, operation: string, args: Any, ctx: { tenantId?: string; system?: boolean }): Any {
  const mode = TENANT_MODELS.get(model);
  if (!mode || ctx.system) return args;
  const { tenantId } = ctx;
  if (!tenantId) {
    if (mode === 'shared' && READ.has(operation)) return { ...args, where: and(args?.where, { tenantId: null }) };
    throw new TenantScopeError(`${model}.${operation} needs an organisation`);
  }
  const own = { tenantId };
  const stamp = (d: Any) => {
    if ('tenant' in d) throw new TenantScopeError('Set the organisation through context only');
    return { ...d, tenantId };
  };
  const noMove = (d: Any) => {
    if (d && ('tenantId' in d || 'tenant' in d)) throw new TenantScopeError('Records cannot change organisation');
    return d;
  };
  if (READ.has(operation)) {
    return { ...args, where: and(args?.where, mode === 'shared' ? { OR: [own, { tenantId: null }] } : own) };
  }
  if (CREATE.has(operation)) {
    return { ...args, data: Array.isArray(args.data) ? args.data.map(stamp) : stamp(args.data) };
  }
  if (operation === 'upsert') {
    noMove(args.update);
    return { ...args, where: and(args.where, own), create: stamp(args.create) };
  }
  if (WRITE.has(operation)) {
    noMove(args?.data);
    return { ...args, where: and(args?.where, own) };
  }
  throw new TenantScopeError(`Operation ${operation} is not allowed on ${model}`);
}

export const tenantScope = Prisma.defineExtension({
  name: 'tenant-scope',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        const ctx = getCtx();
        return query(scopeArgs(model, operation, args as Any, { tenantId: ctx?.tenant?.id, system: ctx?.system }) as typeof args);
      }
    }
  }
});
