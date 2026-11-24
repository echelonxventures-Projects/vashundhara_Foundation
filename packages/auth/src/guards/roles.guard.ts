/**
 * Roles Guard
 * Checks if user has required roles
 */

import type { CanActivate, ExecutionContext} from '@nestjs/common';
import { Injectable, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../constants/auth.constants';

interface UserWithRoles {
  roles: string[];
  [key: string]: unknown;
}

interface RequestWithUser {
  user?: UserWithRoles;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.roles) {
      throw new ForbiddenException('Insufficient permissions: No roles assigned');
    }

    const hasRole = requiredRoles.some((role: string) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(`Insufficient permissions: Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}