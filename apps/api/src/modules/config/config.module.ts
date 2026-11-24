/**
 * Config Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService]
})
export class ConfigModule {}