/**
 * Webhook Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WebhookEvent } from '@vashundhara-foundation/shared';

import { Permissions } from '../../decorators/permissions.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RolesGuard } from '../../guards/roles.guard';

import { WebhookService } from './webhook.service';
import type { Webhook } from './webhook.service';



@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @Permissions('webhooks:read')
  @ApiOperation({ summary: 'List webhooks' })
  @ApiResponse({ status: 200, description: 'List of webhooks' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('isActive') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<{ data: Webhook[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.webhookService.findAll({ tenantId, isActive, page, limit });
  }

  @Get(':id')
  @Permissions('webhooks:read')
  @ApiOperation({ summary: 'Get webhook by ID' })
  @ApiResponse({ status: 200, description: 'Webhook details' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findById(@Param('id') id: string): Promise<Webhook> {
    return this.webhookService.findById(id);
  }

  @Post()
  @Permissions('webhooks:create')
  @ApiOperation({ summary: 'Create webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created' })
  async create(@Body() body: {
    name: string;
    url: string;
    events: WebhookEvent[];
    secret?: string;
    isActive?: boolean;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    headers?: Record<string, string>;
    tenantId?: string;
  }): Promise<Webhook> {
    return this.webhookService.create(body);
  }

  @Post(':id/test')
  @Permissions('webhooks:test')
  @ApiOperation({ summary: 'Test webhook delivery' })
  @ApiResponse({ status: 200, description: 'Test delivery sent' })
  async test(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.webhookService.testDelivery(id);
  }

  @Post(':id/retry-failed')
  @Permissions('webhooks:retry')
  @ApiOperation({ summary: 'Retry failed deliveries' })
  @ApiResponse({ status: 200, description: 'Retry results' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async retryFailed(@Param('id') id: string, @Query('limit') limit?: number): Promise<{ total: number; succeeded: number; failed: number }> {
    return this.webhookService.retryFailed(id, limit);
  }

  @Post(':id/deactivate')
  @Permissions('webhooks:update')
  @ApiOperation({ summary: 'Deactivate webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deactivated' })
  async deactivate(@Param('id') id: string): Promise<Webhook> {
    return this.webhookService.update(id, { isActive: false });
  }

  @Post(':id/activate')
  @Permissions('webhooks:update')
  @ApiOperation({ summary: 'Activate webhook' })
  @ApiResponse({ status: 200, description: 'Webhook activated' })
  async activate(@Param('id') id: string): Promise<Webhook> {
    return this.webhookService.update(id, { isActive: true });
  }

  @Post(':id/delete')
  @Permissions('webhooks:delete')
  @ApiOperation({ summary: 'Delete webhook (soft delete)' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  async delete(@Param('id') id: string): Promise<Webhook> {
    return this.webhookService.delete(id);
  }
}