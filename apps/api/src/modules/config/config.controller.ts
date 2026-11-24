/**
 * Config Controller for Vashundhara Foundation API
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

import { ConfigService } from './config.service';
import type { SystemConfig, TenantConfig } from './config.service';


@ApiTags('Configuration')
@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // ============================================
  // System Config (System Admin only)
  // ============================================

  @Get('system')
  @Roles('super_admin', 'system_admin')
  @Permissions('config:read')
  @ApiOperation({ summary: 'Get all system configs' })
  @ApiResponse({ status: 200, description: 'System configurations' })
  @ApiQuery({ name: 'category', required: false, type: String })
  async getSystemConfigs(@Query('category') category?: string): Promise<SystemConfig[]> {
    return this.configService.getSystemConfigs(category);
  }

  @Get('system/:key')
  @Roles('super_admin', 'system_admin')
  @Permissions('config:read')
  @ApiOperation({ summary: 'Get system config by key' })
  @ApiResponse({ status: 200, description: 'System config' })
  @ApiResponse({ status: 404, description: 'Config not found' })
  async getSystemConfig(@Param('key') key: string): Promise<SystemConfig> {
    return this.configService.getSystemConfig(key);
  }

  @Post('system')
  @Roles('super_admin', 'system_admin')
  @Permissions('config:create')
  @ApiOperation({ summary: 'Create/update system config' })
  @ApiResponse({ status: 200, description: 'Config created/updated' })
  async setSystemConfig(@Body() body: {
    key: string;
    value: unknown;
    description?: string;
    category?: string;
    isPublic?: boolean;
    isEditable?: boolean;
    validationSchema?: Record<string, unknown>;
  }): Promise<SystemConfig> {
    return this.configService.setSystemConfig(body.key, body.value, body);
  }

  @Delete('system/:key')
  @Roles('super_admin')
  @Permissions('config:delete')
  @ApiOperation({ summary: 'Delete system config' })
  @ApiResponse({ status: 200, description: 'Config deleted' })
  async deleteSystemConfig(@Param('key') key: string) {
    return this.configService.deleteSystemConfig(key);
  }

  // ============================================
  // Tenant Config
  // ============================================

  @Get('tenant')
  @Permissions('config:read')
  @ApiOperation({ summary: 'Get all tenant configs' })
  @ApiResponse({ status: 200, description: 'Tenant configurations' })
  @ApiQuery({ name: 'category', required: false, type: String })
  async getTenantConfigs(@Query('category') category?: string): Promise<TenantConfig[]> {
    return this.configService.getTenantConfigs(undefined, category);
  }

  @Get('tenant/:key')
  @Permissions('config:read')
  @ApiOperation({ summary: 'Get tenant config by key' })
  @ApiResponse({ status: 200, description: 'Tenant config value' })
  async getTenantConfig(@Param('key') key: string): Promise<{ key: string; value: unknown }> {
    const value = await this.configService.getTenantConfig(this.getTenantId(), key);
    return { key, value };
  }

  @Post('tenant')
  @Permissions('config:update')
  @ApiOperation({ summary: 'Set tenant config' })
  @ApiResponse({ status: 200, description: 'Config set' })
  async setTenantConfig(@Body() body: {
    key: string;
    value: unknown;
    description?: string;
    category?: string;
  }): Promise<TenantConfig> {
    return this.configService.setTenantConfig(this.getTenantId(), body.key, body.value, body);
  }

  @Put('tenant/:key')
  @Permissions('config:update')
  @ApiOperation({ summary: 'Update tenant config' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  async updateTenantConfig(@Param('key') key: string, @Body() body: { value: unknown }): Promise<TenantConfig> {
    return this.configService.setTenantConfig(this.getTenantId(), key, body.value);
  }

  @Delete('tenant/:key')
  @Permissions('config:delete')
  @ApiOperation({ summary: 'Delete tenant config (revert to system default)' })
  @ApiResponse({ status: 200, description: 'Config deleted' })
  async deleteTenantConfig(@Param('key') key: string) {
    return this.configService.deleteTenantConfig(this.getTenantId(), key);
  }

  @Post('tenant/refresh')
  @Permissions('config:update')
  @ApiOperation({ summary: 'Refresh tenant config cache' })
  @ApiResponse({ status: 200, description: 'Cache refreshed' })
  async refreshCache() {
    return this.configService.refreshTenantCache(this.getTenantId());
  }

  // ============================================
  // Validation
  // ============================================

  @Post('validate')
  @Permissions('config:update')
  @ApiOperation({ summary: 'Validate config value against schema' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateConfig(@Body() body: { key: string; value: unknown }) {
    return this.configService.validateConfig(body.key, body.value);
  }

  private getTenantId(): string {
    // In real implementation, from tenant context
    return 'current-tenant-id';
  }
}