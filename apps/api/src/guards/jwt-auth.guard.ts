/**
 * JWT Auth Guard for Vashundhara Foundation API
 */

import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  locale: string;
  currency: string;
  timezone: string;
  iat?: number;
  exp?: number;
}

export interface RequestWithTenant extends Request {
  cookies: Record<string, string>;
  tenant?: import('@vashundhara-foundation/shared').Tenant;
  tenantId?: string;
  tenantResolutionSource?: string;
  user?: JwtPayload & { id: string };
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();

    // Try to get token from cookie first, then header
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      // Attach user with id mapped from sub
      request.user = {
        ...payload,
        id: payload.sub,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: RequestWithTenant): string | null {
    // Check cookie
    if (request.cookies?.refreshToken) {
      return request.cookies.refreshToken;
    }

    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}