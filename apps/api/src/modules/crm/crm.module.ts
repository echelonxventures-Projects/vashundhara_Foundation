/**
 * CRM Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';
import { CrmController } from './controllers/crm.controller';
import { CrmService } from './services/crm.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService]
})
export class CrmModule {}