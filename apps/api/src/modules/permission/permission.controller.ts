/**
 * Permission Controller for Vashundhara Foundation API
 */

import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionAction } from '@vashundhara-foundation/shared';

import { Permissions } from '../../decorators/permissions.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RolesGuard } from '../../guards/roles.guard';

import { PermissionService } from './permission.service';


@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'List all permissions grouped by resource' })
  @ApiResponse({ status: 200, description: 'List of permissions' })
  async findAll() {
    return this.permissionService.findAll();
  }

  @Post('seed')
  @Roles('super_admin', 'system_admin')
  @Permissions('permissions:create')
  @ApiOperation({ summary: 'Seed default permissions (system admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions seeded' })
  async seed() {
    return this.permissionService.seedDefaultPermissions();
  }

  @Post()
  @Roles('super_admin', 'system_admin')
  @Permissions('permissions:create')
  @ApiOperation({ summary: 'Create permission (system admin only)' })
  @ApiResponse({ status: 201, description: 'Permission created' })
  @ApiResponse({ status: 409, description: 'Permission already exists' })
  async create(@Body() body: { resource: string; action: PermissionAction; description?: string }) {
    return this.permissionService.create(body);
  }

  @Get(':id')
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiResponse({ status: 200, description: 'Permission details' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  async findById(@Param('id') id: string) {
    return this.permissionService.findById(id);
  }
}