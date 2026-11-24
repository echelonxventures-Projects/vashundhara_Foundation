import { Global, Injectable, Module } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { getCtx, runAsSystem } from '../context/context';
import { PrismaService } from '../prisma/prisma.module';

const SECRET = /hash|secret|enc$|token|password|pan$|panlast4|backup/i;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || depth > 6) return null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    if (Prisma.Decimal.isDecimal(value)) return String(value);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET.test(k) ? '[redacted]' : redact(v, depth + 1)]));
  }
  return value;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async log(action: AuditAction, resource: string, resourceId?: string | null, oldValues?: unknown, newValues?: unknown, override?: { tenantId?: string | null; userId?: string | null }) {
    const c = getCtx();
    await runAsSystem(() =>
      this.prisma.auditLog.create({
        data: {
          action, resource, resourceId: resourceId ?? null,
          oldValues: oldValues === undefined ? undefined : (redact(oldValues) as Prisma.InputJsonValue),
          newValues: newValues === undefined ? undefined : (redact(newValues) as Prisma.InputJsonValue),
          tenantId: override?.tenantId !== undefined ? override.tenantId : c?.tenant?.id ?? null,
          userId: override?.userId !== undefined ? override.userId : c?.user?.id ?? null,
          ipAddress: c?.ip, userAgent: c?.userAgent, correlationId: c?.requestId
        }
      })
    );
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
