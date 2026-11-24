/**
 * Role Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { Permissions } from '../../decorators/permissions.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RolesGuard } from '../../guards/roles.guard';

import { RoleService } from './role.service';


@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @Permissions('roles:read')
  @ApiOperation({ summary: 'List roles' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'scope', required: false, enum: ['SYSTEM', 'TENANT'] })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('scope') scope?: 'SYSTEM' | 'TENANT',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ) {
    return this.roleService.findAll({ page, limit, search, scope, sortBy, sortOrder });
  }

  @Post()
  @Permissions('roles:create')
  @ApiOperation({ summary: 'Create role' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Role name already exists' })
  async create(@Body() body: {
    name: string;
    displayName: string;
    description?: string;
    scope?: 'SYSTEM' | 'TENANT';
    priority?: number;
    permissionIds?: string[];
  }) {
    return this.roleService.create(body);
  }

  @Get(':id')
  @Permissions('roles:read')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiResponse({ status: 200, description: 'Role details' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findById(@Param('id') id: string) {
    return this.roleService.findById(id);
  }

  @Put(':id')
  @Permissions('roles:update')
  @ApiOperation({ summary: 'Update role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      displayName?: string;
      description?: string;
      priority?: number;
      permissionIds?: string[];
    }
  ) {
    return this.roleService.update(id, body);
  }

  @Delete(':id')
  @Permissions('roles:delete')
  @ApiOperation({ summary: 'Delete role' })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete role with assigned users' })
  async delete(@Param('id') id: string) {
    return this.roleService.delete(id);
  }

  @Put(':id/permissions')
  @Permissions('roles:update')
  @ApiOperation({ summary: 'Assign permissions to role' })
  @ApiResponse({ status: 200, description: 'Permissions assigned' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async assignPermissions(@Param('id') id: string, @Body() body: { permissionIds: string[] }) {
    return this.roleService.assignPermissions(id, body.permissionIds);
  }
}