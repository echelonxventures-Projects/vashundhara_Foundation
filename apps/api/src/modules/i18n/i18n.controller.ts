/**
 * I18n Controller for Vashundhara Foundation API
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

import { I18nService } from './i18n.service';


@ApiTags('Internationalization')
@Controller('i18n')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get('translations')
  @Permissions('translations:read')
  @ApiOperation({ summary: 'Get translations for namespace and locale' })
  @ApiResponse({ status: 200, description: 'Translations' })
  @ApiQuery({ name: 'namespace', required: true, type: String })
  @ApiQuery({ name: 'locale', required: true, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async getTranslations(
    @Query('namespace') namespace: string,
    @Query('locale') locale: string,
    @Query('tenantId') tenantId?: string
  ) {
    return this.i18nService.getTranslations(namespace, locale, tenantId);
  }

  @Get('namespaces')
  @Permissions('translations:read')
  @ApiOperation({ summary: 'Get available namespaces for locale' })
  @ApiResponse({ status: 200, description: 'List of namespaces' })
  @ApiQuery({ name: 'locale', required: true, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async getNamespaces(
    @Query('locale') locale: string,
    @Query('tenantId') tenantId?: string
  ) {
    return this.i18nService.getNamespaces(locale, tenantId);
  }

  @Post('translations')
  @Permissions('translations:create')
  @ApiOperation({ summary: 'Create/update translation' })
  @ApiResponse({ status: 200, description: 'Translation created/updated' })
  async createTranslation(@Body() body: {
    namespace: string;
    key: string;
    value: string;
    locale: string;
    tenantId?: string;
    context?: string;
  }) {
    return this.i18nService.createTranslation(body);
  }

  @Put('translations/:id')
  @Permissions('translations:update')
  @ApiOperation({ summary: 'Update translation' })
  @ApiResponse({ status: 200, description: 'Translation updated' })
  async updateTranslation(
    @Param('id') id: string,
    @Body() body: { value: string; context?: string; isReviewed?: boolean }
  ) {
    return this.i18nService.updateTranslation(id, body);
  }

  @Delete('translations/:id')
  @Permissions('translations:delete')
  @ApiOperation({ summary: 'Delete translation' })
  @ApiResponse({ status: 200, description: 'Translation deleted' })
  async deleteTranslation(@Param('id') id: string) {
    return this.i18nService.deleteTranslation(id);
  }

  @Post('translations/bulk')
  @Permissions('translations:create')
  @ApiOperation({ summary: 'Bulk create/update translations' })
  @ApiResponse({ status: 200, description: 'Translations created/updated' })
  async bulkCreate(@Body() body: { translations: Array<{
    namespace: string;
    key: string;
    value: string;
    locale: string;
    tenantId?: string;
    context?: string;
  }> }) {
    return this.i18nService.bulkCreateTranslations(body.translations);
  }
}