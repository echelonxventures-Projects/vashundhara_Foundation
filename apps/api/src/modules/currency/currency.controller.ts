/**
 * Currency Controller for Vashundhara Foundation API
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
import type { Prisma } from '@vashundhara-foundation/database';

import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';
import type { Currency } from './currency.service';
import type { ExchangeRate } from './exchange-rate.service';


@ApiTags('Currencies')
@Controller('currencies')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class CurrencyController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly exchangeRateService: ExchangeRateService
  ) {}

  // ============================================
  // Currencies
  // ============================================

  @Get()
  @Permissions('currencies:read')
  @ApiOperation({ summary: 'List all currencies' })
  @ApiResponse({ status: 200, description: 'List of currencies' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async findAll(@Query('tenantId') tenantId?: string): Promise<Currency[]> {
    return this.currencyService.findAll(tenantId);
  }

  @Get('base')
  @Permissions('currencies:read')
  @ApiOperation({ summary: 'Get base currency' })
  @ApiResponse({ status: 200, description: 'Base currency' })
  async getBase(): Promise<Currency> {
    return this.currencyService.getBaseCurrency();
  }

  @Get(':id')
  @Permissions('currencies:read')
  @ApiOperation({ summary: 'Get currency by ID' })
  @ApiResponse({ status: 200, description: 'Currency details' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async findById(@Param('id') id: string): Promise<Currency> {
    return this.currencyService.findById(id);
  }

  @Get('code/:code')
  @Permissions('currencies:read')
  @ApiOperation({ summary: 'Get currency by code' })
  @ApiResponse({ status: 200, description: 'Currency details' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async findByCode(@Param('code') code: string, @Query('tenantId') tenantId?: string): Promise<Currency> {
    return this.currencyService.findByCode(code, tenantId);
  }

  @Post()
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('currencies:create')
  @ApiOperation({ summary: 'Create currency' })
  @ApiResponse({ status: 201, description: 'Currency created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Currency code already exists' })
  async create(@Body() body: {
    code: string;
    symbol: string;
    symbolPosition?: 'prefix' | 'suffix';
    decimals?: number;
    name: string;
    namePlural: string;
    isBase?: boolean;
    formatting?: Prisma.InputJsonValue;
    tenantId?: string;
  }): Promise<Currency> {
    return this.currencyService.create({
      ...body,
      formatting: body.formatting as Prisma.InputJsonValue | undefined
    });
  }

  @Put(':id')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('currencies:update')
  @ApiOperation({ summary: 'Update currency' })
  @ApiResponse({ status: 200, description: 'Currency updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      symbol?: string;
      symbolPosition?: 'prefix' | 'suffix';
      decimals?: number;
      name?: string;
      namePlural?: string;
      isActive?: boolean;
      formatting?: Prisma.InputJsonValue;
    }
  ): Promise<Currency> {
    return this.currencyService.update(id, {
      ...body,
      formatting: body.formatting as Prisma.InputJsonValue | undefined
    });
  }

  @Delete(':id')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('currencies:delete')
  @ApiOperation({ summary: 'Delete currency' })
  @ApiResponse({ status: 200, description: 'Currency deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete base currency' })
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.currencyService.delete(id);
  }

  // ============================================
  // Exchange Rates
  // ============================================

  @Get('rates')
  @Permissions('exchange_rates:read')
  @ApiOperation({ summary: 'List exchange rates' })
  @ApiResponse({ status: 200, description: 'List of exchange rates' })
  @ApiQuery({ name: 'baseCurrencyId', required: false, type: String })
  @ApiQuery({ name: 'targetCurrencyId', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findRates(
    @Query('baseCurrencyId') baseCurrencyId?: string,
    @Query('targetCurrencyId') targetCurrencyId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<{ data: ExchangeRate[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.exchangeRateService.findAll({ baseCurrencyId, targetCurrencyId, tenantId, page, limit });
  }

  @Get('rates/convert')
  @Permissions('exchange_rates:read')
  @ApiOperation({ summary: 'Convert amount between currencies' })
  @ApiResponse({ status: 200, description: 'Converted amount' })
  @ApiQuery({ name: 'amount', required: true, type: Number })
  @ApiQuery({ name: 'from', required: true, type: String })
  @ApiQuery({ name: 'to', required: true, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async convert(
    @Query('amount') amount: number,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tenantId') tenantId?: string
  ): Promise<{ amount: number; from: string; to: string }> {
    const result = await this.exchangeRateService.convert(amount, from, to, tenantId);
    return { amount: result, from, to };
  }

  @Get('rates/:id')
  @Permissions('exchange_rates:read')
  @ApiOperation({ summary: 'Get exchange rate by ID' })
  @ApiResponse({ status: 200, description: 'Exchange rate details' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  async findRateById(@Param('id') id: string): Promise<ExchangeRate> {
    return this.exchangeRateService.findById(id);
  }

  @Post('rates')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('exchange_rates:create')
  @ApiOperation({ summary: 'Create exchange rate' })
  @ApiResponse({ status: 201, description: 'Exchange rate created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async createRate(@Body() body: {
    baseCurrencyId: string;
    targetCurrencyId: string;
    rate: number;
    source?: string;
    validFrom?: string;
    validUntil?: string;
    isManual?: boolean;
    tenantId?: string;
  }) {
    return this.exchangeRateService.create({
      baseCurrencyId: body.baseCurrencyId,
      targetCurrencyId: body.targetCurrencyId,
      rate: new (require('@prisma/client/runtime/library').Decimal)(body.rate),
      source: body.source,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      isManual: body.isManual,
      tenantId: body.tenantId
    });
  }

  @Put('rates/:id')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('exchange_rates:update')
  @ApiOperation({ summary: 'Update exchange rate' })
  @ApiResponse({ status: 200, description: 'Exchange rate updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  async updateRate(
    @Param('id') id: string,
    @Body() body: {
      rate?: number;
      validUntil?: string;
      source?: string;
    }
  ) {
    const Decimal = require('@prisma/client/runtime/library').Decimal;
    return this.exchangeRateService.update(id, {
      rate: body.rate !== undefined ? new Decimal(body.rate) : undefined,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      source: body.source
    });
  }

  @Delete('rates/:id')
  @Roles('super_admin', 'system_admin', 'tenant_admin')
  @Permissions('exchange_rates:delete')
  @ApiOperation({ summary: 'Delete exchange rate' })
  @ApiResponse({ status: 200, description: 'Exchange rate deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  async deleteRate(@Param('id') id: string) {
    return this.exchangeRateService.delete(id);
  }

  @Post('rates/sync')
  @Roles('super_admin', 'system_admin')
  @Permissions('exchange_rates:create')
  @ApiOperation({ summary: 'Sync latest exchange rates from provider' })
  @ApiResponse({ status: 200, description: 'Rates synced' })
  @ApiQuery({ name: 'baseCurrency', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async syncRates(
    @Query('baseCurrency') baseCurrency?: string,
    @Query('tenantId') tenantId?: string
  ) {
    return this.exchangeRateService.syncRates(baseCurrency || 'USD', tenantId);
  }
}