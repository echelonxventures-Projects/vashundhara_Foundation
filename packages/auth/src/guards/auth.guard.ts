/**
 * Authentication Guard
 * Validates JWT tokens and extracts user context
 */

import type { CanActivate, ExecutionContext} from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

import { verifyToken, extractTokenFromHeader } from '../utils/jwt';

interface AuthenticatedRequest {
  user?: Record<string, unknown>;
  headers?: {
    authorization?: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers?.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = await verifyToken(token);
      request.user = payload as Record<string, unknown>;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}