import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import { getCtx } from '../context/context';
import { TenantScopeError } from '../prisma/tenant-scope';

interface Out { status: number; code: string; message: string; details?: unknown }

function classify(e: unknown): Out {
  if (e instanceof HttpException) {
    const r = e.getResponse();
    const body = typeof r === 'string' ? { message: r } : (r as Record<string, unknown>);
    const message = Array.isArray(body.message) ? body.message.join(', ') : String(body.message ?? e.message);
    return { status: e.getStatus(), code: String(body.code ?? e.name.replace(/Exception$/, '')), message, details: body.details };
  }
  if (e instanceof TenantScopeError) return { status: 403, code: 'TENANT_SCOPE', message: 'Not available for this organisation' };
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return { status: 409, code: 'DUPLICATE', message: 'That already exists' };
    if (e.code === 'P2025') return { status: 404, code: 'NOT_FOUND', message: 'Not found' };
    if (e.code === 'P2003') return { status: 400, code: 'BAD_REFERENCE', message: 'A linked record does not exist or is still in use' };
    if (e.code === 'P2010' && /23503/.test(JSON.stringify(e.meta))) return { status: 400, code: 'BAD_REFERENCE', message: 'A linked record does not exist' };
  }
  if (e instanceof Prisma.PrismaClientUnknownRequestError && /23503|cross-tenant|cannot be assigned|does not belong/.test(e.message)) {
    return { status: 400, code: 'BAD_REFERENCE', message: 'A linked record does not exist' };
  }
  const type = (e as { type?: string })?.type;
  if (type === 'entity.too.large') return { status: 413, code: 'TOO_LARGE', message: 'Request is too large' };
  if (type === 'entity.parse.failed') return { status: 400, code: 'BAD_JSON', message: 'Invalid JSON' };
  return { status: 500, code: 'INTERNAL', message: 'Something went wrong' };
}

@Catch()
export class ErrorsFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const out = classify(e);
    const requestId = getCtx()?.requestId;
    if (out.status >= 500) {
      console.error(JSON.stringify({ level: 'error', requestId, error: (e as Error)?.message, stack: (e as Error)?.stack }));
      Sentry.captureException(e);
    }
    if (res.headersSent) return;
    res.status(out.status).json({ error: { code: out.code, message: out.message, details: out.details }, requestId });
  }
}
