/**
 * Currency Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CurrencyController],
  providers: [CurrencyService, ExchangeRateService],
  exports: [CurrencyService, ExchangeRateService]
})
export class CurrencyModule {}