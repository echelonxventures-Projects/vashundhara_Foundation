/**
 * Feature Flag Controller for Vashundhara Foundation API
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

import { FeatureFlagService } from './feature-flag.service';


@ApiTags('Feature Flags')
@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get()
  @Permissions('feature_flags:read')
  @ApiOperation({ summary: 'List feature flags' })
  @ApiResponse({ status: 200, description: 'List of feature flags' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'isEnabled', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('isEnabled') isEnabled?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.featureFlagService.findAll({ tenantId, isEnabled, page, limit });
  }

  @Get(':id')
  @Permissions('feature_flags:read')
  @ApiOperation({ summary: 'Get feature flag by ID' })
  @ApiResponse({ status: 200, description: 'Feature flag details' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async findById(@Param('id') id: string) {
    return this.featureFlagService.findById(id);
  }

  @Get('key/:key')
  @Permissions('feature_flags:read')
  @ApiOperation({ summary: 'Get feature flag by key' })
  @ApiResponse({ status: 200, description: 'Feature flag details' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async findByKey(@Param('key') key: string, @Query('tenantId') tenantId?: string) {
    return this.featureFlagService.findByKey(key, tenantId);
  }

  @Post()
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('feature_flags:create')
  @ApiOperation({ summary: 'Create feature flag' })
  @ApiResponse({ status: 201, description: 'Feature flag created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Feature flag key already exists' })
  async create(@Body() body: {
    key: string;
    name: string;
    description?: string;
    type: 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON';
    defaultValue: unknown;
    isEnabled?: boolean;
    rolloutPercentage?: number;
    targetingRules?: Record<string, unknown>;
    tenantId?: string;
  }) {
    return this.featureFlagService.create(body);
  }

  @Put(':id')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('feature_flags:update')
  @ApiOperation({ summary: 'Update feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string;
      defaultValue?: unknown;
      isEnabled?: boolean;
      rolloutPercentage?: number;
      targetingRules?: Record<string, unknown>;
    }
  ) {
    return this.featureFlagService.update(id, body);
  }

  @Delete(':id')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('feature_flags:delete')
  @ApiOperation({ summary: 'Delete feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async delete(@Param('id') id: string) {
    return this.featureFlagService.delete(id);
  }

  @Post(':key/toggle')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('feature_flags:update')
  @ApiOperation({ summary: 'Toggle feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag toggled' })
  async toggle(@Param('key') key: string, @Query('tenantId') tenantId?: string) {
    return this.featureFlagService.toggle(key, tenantId);
  }

  @Post(':key/rollout')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('feature_flags:update')
  @ApiOperation({ summary: 'Set rollout percentage' })
  @ApiResponse({ status: 200, description: 'Rollout percentage set' })
  async setRollout(@Param('key') key: string, @Body() body: { percentage: number }, @Query('tenantId') tenantId?: string) {
    return this.featureFlagService.setRollout(key, body.percentage, tenantId);
  }

  @Post('evaluate')
  @Permissions('feature_flags:read')
  @ApiOperation({ summary: 'Evaluate feature flag for context' })
  @ApiResponse({ status: 200, description: 'Feature flag value' })
  async evaluate(@Body() body: { key: string; context: Record<string, unknown> }) {
    const value = await this.featureFlagService.evaluate(body.key, body.context);
    return { key: body.key, value };
  }
}