/**
 * File Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Get,
  Post,
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

import { FileService } from './file.service';
import type { File } from './file.service';


@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get()
  @Permissions('files:read')
  @ApiOperation({ summary: 'List files' })
  @ApiResponse({ status: 200, description: 'List of files' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'mimeType', required: false, type: String })
  @ApiQuery({ name: 'uploadedById', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('mimeType') mimeType?: string,
    @Query('uploadedById') uploadedById?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<{ data: File[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.fileService.findAll({
      tenantId,
      mimeType,
      uploadedById,
      page,
      limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  @Get(':id')
  @Permissions('files:read')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiResponse({ status: 200, description: 'File details' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async findById(@Param('id') id: string): Promise<File> {
    return this.fileService.findById(id);
  }

  @Post('upload-url')
  @Permissions('files:create')
  @ApiOperation({ summary: 'Get presigned upload URL' })
  @ApiResponse({ status: 200, description: 'Upload URL generated' })
  async createUploadUrl(@Body() body: {
    filename: string;
    mimeType: string;
    size: number;
    isPublic?: boolean;
    expiresAt?: string;
  }): Promise<{ uploadUrl: string; file: File }> {
    return this.fileService.createUploadUrl({
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
    });
  }

  @Post(':id/complete')
  @Permissions('files:create')
  @ApiOperation({ summary: 'Complete file upload' })
  @ApiResponse({ status: 200, description: 'Upload completed' })
  async completeUpload(@Param('id') id: string, @Body() body: { checksum: string }): Promise<File> {
    return this.fileService.completeUpload(id, body.checksum);
  }

  @Get(':id/download-url')
  @Permissions('files:read')
  @ApiOperation({ summary: 'Get presigned download URL' })
  @ApiResponse({ status: 200, description: 'Download URL generated' })
  async getDownloadUrl(@Param('id') id: string): Promise<{ downloadUrl: string }> {
    return this.fileService.getDownloadUrl(id);
  }

  @Delete(':id')
  @Permissions('files:delete')
  @ApiOperation({ summary: 'Delete file' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.fileService.delete(id);
  }
}