import { Body, PipeTransform, Query, SetMetadata, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import type { Permission } from '@vashundhara-foundation/shared';
import { z, ZodType } from 'zod';

export const PUBLIC = 'vf:public';
export const PERMISSIONS = 'vf:permissions';
export const SELF = 'vf:self';
export const PLATFORM = 'vf:platform';
export const RATE = 'vf:rate';

/** No sign-in needed. */
export const Public = () => SetMetadata(PUBLIC, true);
/** Any signed-in user; the handler must only touch that user's own data. */
export const SelfService = () => SetMetadata(SELF, true);
/** Platform operators only. */
export const PlatformAdmin = () => SetMetadata(PLATFORM, true);
export const Can = (...permissions: Permission[]) => SetMetadata(PERMISSIONS, permissions);
/** `limit` requests per `seconds` per IP, and per account when `field` names a body field. */
export const RateLimit = (limit: number, seconds: number, field?: string) => SetMetadata(RATE, { limit, seconds, field });

export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}
  transform(value: unknown) {
    const r = this.schema.safeParse(value ?? {});
    if (r.success) return r.data;
    throw new UnprocessableEntityException({
      message: 'Please check the highlighted fields',
      code: 'VALIDATION',
      details: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    });
  }
}

export const ZBody = (schema: ZodType): ParameterDecorator => (target, key, index) => {
  Body(new ZodPipe(schema))(target, key, index);
  const descriptor = key && Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) return;
  try {
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    delete json.$schema;
    ApiBody({ schema: json })(target, key, descriptor);
  } catch {
    /* documentation only */
  }
};
export const ZQuery = (schema: ZodType): ParameterDecorator => Query(new ZodPipe(schema));

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  sort: z.string().max(40).optional()
});
export type Paging = z.infer<typeof PageQuery>;
