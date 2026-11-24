/**
 * API Key Strategy
 * Validates API keys for machine-to-machine authentication
 */

import { createHash } from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy from 'passport-headerapikey';

import { PrismaService } from '../../../common/prisma/prisma.service';

export interface ApiKeyPayload {
  id: string;
  name: string;
  tenantId: string;
  permissions: string[];
  expiresAt?: Date;
}

// Typed Prisma interfaces for ApiKeyStrategy
interface ApiKeyFindUniqueArgs {
  where: { keyHash: string };
  include?: { user: { select: { id: true; tenantId: true } } };
}

interface ApiKeyUpdateArgs {
  where: { id: string };
  data: { lastUsedAt: Date };
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly prisma: PrismaService) {
    super(
      { header: 'x-api-key', prefix: '' },
      true,
      async (apiKey: string, done: (error: Error | null, data?: ApiKeyPayload) => void) => {
        try {
          // Hash the API key to compare with stored hash
          const keyHash = createHash('sha256').update(apiKey).digest('hex');

          const typedPrisma = prisma as PrismaService & {
            apiKey: {
              findUnique<T = { id: string; name: string; user: { tenantId: string }; permissions: string[]; expiresAt: Date | null } | null>(
                args: ApiKeyFindUniqueArgs
              ): Promise<T>;
              update(args: ApiKeyUpdateArgs): Promise<{ id: string }>;
            };
          };

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const key = await typedPrisma.apiKey.findUnique({
            where: { keyHash },
            include: { user: { select: { id: true, tenantId: true } } }
          });

          if (!key) {
            return done(new UnauthorizedException('Invalid API key'), undefined);
          }

          if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
            return done(new UnauthorizedException('API key expired'), undefined);
          }

          // Update last used timestamp
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await typedPrisma.apiKey.update({
            where: { id: key.id },
            data: { lastUsedAt: new Date() }
          });

          const payload: ApiKeyPayload = {
            id: key.id,
            name: key.name,
            tenantId: key.user.tenantId,
            permissions: key.permissions,
            expiresAt: key.expiresAt || undefined
          };

          return done(null, payload);
        } catch (error) {
          return done(new UnauthorizedException('API key validation failed'), undefined);
        }
      }
    );
  }
}