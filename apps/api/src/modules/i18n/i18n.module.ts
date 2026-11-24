/**
 * I18n Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

import { I18nController } from './i18n.controller';
import { I18nService } from './i18n.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [I18nController],
  providers: [I18nService],
  exports: [I18nService]
})
export class I18nModule {}