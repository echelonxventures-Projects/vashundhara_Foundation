/**
 * API Key Strategy
 * Validates API keys for machine-to-machine authentication
 * Base class to be extended by application with custom validation logic
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy from 'passport-headerapikey';

export interface ApiKeyPayload {
  id: string;
  name: string;
  tenantId: string;
  permissions: string[];
  expiresAt?: Date;
}

export interface ApiKeyValidator {
  validate(apiKey: string): Promise<ApiKeyPayload | null>;
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  private readonly validator: ApiKeyValidator;

  constructor(validator: ApiKeyValidator) {
    super(
      { header: 'x-api-key', prefix: '' },
      true,
      async (apiKey: string, done: (error: Error | null, data?: ApiKeyPayload) => void) => {
        try {
          const payload = await validator.validate(apiKey);

          if (!payload) {
            return done(new UnauthorizedException('Invalid API key'), undefined);
          }

          if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
            return done(new UnauthorizedException('API key expired'), undefined);
          }

          return done(null, payload);
        } catch (error) {
          return done(new UnauthorizedException('API key validation failed'), undefined);
        }
      }
    );

    this.validator = validator;
  }
}