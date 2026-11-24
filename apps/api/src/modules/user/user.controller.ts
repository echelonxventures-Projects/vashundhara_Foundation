/**
 * User Controller for Vashundhara Foundation API
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
  UseGuards,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { Permissions } from '../../decorators/permissions.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RolesGuard } from '../../guards/roles.guard';

import { UserService } from './user.service';
import type { User } from './user.service';

// Request with user from JWT auth guard
interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
    isSystemAdmin: boolean;
  };
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ): Promise<{ data: User[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.userService.findAll({ page, limit, search, status, role, sortBy, sortOrder });
  }

  @Get('profile')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getProfile(@Req() req: AuthenticatedRequest): Promise<User> {
    return this.userService.getProfile(req.user.sub);
  }

  @Put('profile')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(@Req() req: AuthenticatedRequest, @Body() body: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
    locale?: string;
    timezone?: string;
    phone?: string;
  }): Promise<User> {
    return this.userService.updateProfile(req.user.sub, body);
  }

  @Post('password')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  async changePassword(@Req() req: AuthenticatedRequest, @Body() body: { currentPassword: string; newPassword: string }): Promise<{ success: boolean }> {
    return this.userService.updatePassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @Post()
  @Permissions('users:create')
  @ApiOperation({ summary: 'Create user (admin)' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async create(@Body() body: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    locale?: string;
    timezone?: string;
    roles?: string[];
  }): Promise<User> {
    return this.userService.create(body);
  }

  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(@Param('id') id: string): Promise<User> {
    return this.userService.findById(id);
  }

  @Put(':id')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      avatarUrl?: string;
      locale?: string;
      timezone?: string;
      phone?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      metadata?: Record<string, unknown>;
      roles?: string[];
    }
  ): Promise<User> {
    return this.userService.update(id, body);
  }

  @Delete(':id')
  @Permissions('users:delete')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.userService.delete(id);
  }
}