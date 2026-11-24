/**
 * Audit Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditAction, AUDIT_ACTION_VALUES } from '@vashundhara-foundation/shared';

import { Permissions } from '../../decorators/permissions.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RolesGuard } from '../../guards/roles.guard';

import { AuditService } from './audit.service';



@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('audit_logs:read')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, enum: AUDIT_ACTION_VALUES })
  @ApiQuery({ name: 'resourceId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: AuditAction,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ) {
    return this.auditService.findAll({
      tenantId,
      userId,
      resource,
      action,
      resourceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
      sortBy,
      sortOrder
    });
  }

  @Get('stats')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('audit_logs:read')
  @ApiOperation({ summary: 'Get audit log statistics' })
  @ApiResponse({ status: 200, description: 'Audit log statistics' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getStats(
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.auditService.getStats(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Get('resource/:resource/:resourceId')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('audit_logs:read')
  @ApiOperation({ summary: 'Get resource history' })
  @ApiResponse({ status: 200, description: 'Resource audit history' })
  async getResourceHistory(
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
    @Query('tenantId') tenantId?: string
  ) {
    return this.auditService.getResourceHistory(resource, resourceId, tenantId);
  }

  @Get('user/:userId')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('audit_logs:read')
  @ApiOperation({ summary: 'Get user activity' })
  @ApiResponse({ status: 200, description: 'User activity logs' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: number
  ) {
    return this.auditService.getUserActivity(userId, tenantId, limit);
  }

  @Get('export')
  @Roles('super_admin', 'system_admin')
  @Permissions('audit_logs:export')
  @ApiOperation({ summary: 'Export audit logs' })
  @ApiResponse({ status: 200, description: 'Exported audit logs' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, enum: AUDIT_ACTION_VALUES })
  async exportLogs(
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: AuditAction
  ) {
    return this.auditService.exportLogs({
      tenantId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      resource,
      action
    });
  }
}