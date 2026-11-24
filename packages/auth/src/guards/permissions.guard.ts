/**
 * Permissions Guard
 * Checks if user has required permissions
 */

import type { CanActivate, ExecutionContext} from '@nestjs/common';
import { Injectable, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../constants/auth.constants';

interface UserWithPermissions {
  permissions: string[];
  [key: string]: unknown;
}

interface RequestWithUser {
  user?: UserWithPermissions;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.permissions) {
      throw new ForbiddenException('Insufficient permissions: No permissions assigned');
    }

    const hasPermission = requiredPermissions.some((permission: string) => user.permissions.includes(permission));

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions: Required permissions: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}