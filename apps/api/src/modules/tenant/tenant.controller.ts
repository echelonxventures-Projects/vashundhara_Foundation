/**
 * Tenant Controller for Vashundhara Foundation API
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
import { Roles } from '../../decorators/roles.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RolesGuard } from '../../guards/roles.guard';

import { TenantService } from './tenant.service';
import type { Tenant } from './tenant.service';


@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles('super_admin')
  @Permissions('tenants:create')
  @ApiOperation({ summary: 'Create a new tenant (system admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Slug or domain already exists' })
  async create(@Body() body: {
    name: string;
    displayName?: string;
    description?: string;
    slug?: string;
    primaryDomain?: string;
    defaultCurrency?: string;
    defaultLocale?: string;
    timezone?: string;
    settings?: Record<string, unknown>;
  }) {
    return this.tenantService.create(body);
  }

  @Get()
  @Roles('super_admin', 'system_admin')
  @Permissions('tenants:read')
  @ApiOperation({ summary: 'List all tenants (system admin) or current tenant' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ): Promise<{ data: Tenant[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.tenantService.findAll({ page, limit, search, status, sortBy, sortOrder });
  }

  @Get('stats')
  @Permissions('tenants:read')
  @ApiOperation({ summary: 'Get tenant statistics' })
  @ApiResponse({ status: 200, description: 'Tenant statistics' })
  async getStats(): Promise<{ users: number; donations: number; campaigns: number; revenue: number }> {
    const tenantId = this.getTenantId();
    return this.tenantService.getStats(tenantId);
  }

  @Get('settings')
  @Permissions('tenants:read')
  @ApiOperation({ summary: 'Get tenant settings' })
  @ApiResponse({ status: 200, description: 'Tenant settings' })
  async getSettings(): Promise<Record<string, unknown>> {
    const tenantId = this.getTenantId();
    return this.tenantService.getSettings(tenantId);
  }

  @Put('settings')
  @Permissions('tenants:update')
  @ApiOperation({ summary: 'Update tenant settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(@Body() settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    const tenantId = this.getTenantId();
    return this.tenantService.updateSettings(tenantId, settings);
  }

  @Get(':id')
  @Permissions('tenants:read')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findById(@Param('id') id: string): Promise<Tenant> {
    return this.tenantService.findById(id);
  }

  @Put(':id')
  @Permissions('tenants:update')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Domain already in use' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      displayName?: string;
      description?: string;
      primaryDomain?: string;
      defaultCurrency?: string;
      defaultLocale?: string;
      timezone?: string;
      settings?: Record<string, unknown>;
      status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_SETUP' | 'ARCHIVED';
    }
  ): Promise<Tenant> {
    return this.tenantService.update(id, body);
  }

  @Delete(':id')
  @Roles('super_admin')
  @Permissions('tenants:delete')
  @ApiOperation({ summary: 'Delete tenant (system admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.tenantService.delete(id);
  }

  private getTenantId(): string {
    // In real implementation, this would come from the tenant context
    // For now, return a placeholder
    return 'current-tenant-id';
  }
}