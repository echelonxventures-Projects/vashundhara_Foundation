/**
 * Notification Controller for Vashundhara Foundation API
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
import { NotificationChannel, NOTIFICATION_CHANNELS, NotificationStatus, NOTIFICATION_STATUSES } from '@vashundhara-foundation/shared';

import { Permissions } from '../../decorators/permissions.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RolesGuard } from '../../guards/roles.guard';

import { NotificationService } from './notification.service';



@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'List notifications' })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, enum: NOTIFICATION_CHANNELS })
  @ApiQuery({ name: 'status', required: false, enum: NOTIFICATION_STATUSES })
  @ApiQuery({ name: 'templateId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('channel') channel?: NotificationChannel,
    @Query('status') status?: NotificationStatus,
    @Query('templateId') templateId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.notificationService.findAll({
      tenantId,
      userId,
      channel,
      status,
      templateId,
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  @Get(':id')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findById(@Param('id') id: string) {
    return this.notificationService.findById(id);
  }

  @Post()
  @Permissions('notifications:create')
  @ApiOperation({ summary: 'Create and send notification' })
  @ApiResponse({ status: 201, description: 'Notification created' })
  async create(@Body() body: {
    templateId?: string;
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    content: string;
    contentHtml?: string;
    priority?: number;
    scheduledAt?: string;
    metadata?: Record<string, unknown>;
    userId?: string;
  }) {
    return this.notificationService.create({
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined
    });
  }

  @Post(':id/send')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Send notification' })
  @ApiResponse({ status: 200, description: 'Notification sent' })
  async send(@Param('id') id: string) {
    return this.notificationService.sendNotification(id);
  }

  @Post('retry-failed')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('notifications:send')
  @ApiOperation({ summary: 'Retry failed notifications' })
  @ApiResponse({ status: 200, description: 'Retry results' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async retryFailed(@Query('limit') limit?: number) {
    return this.notificationService.retryFailed(limit);
  }
}