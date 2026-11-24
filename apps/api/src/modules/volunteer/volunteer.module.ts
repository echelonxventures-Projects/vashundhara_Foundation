/**
 * Volunteer Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';
import { VolunteerController } from './controllers/volunteer.controller';
import { VolunteerService } from './services/volunteer.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [VolunteerController],
  providers: [VolunteerService],
  exports: [VolunteerService]
})
export class VolunteerModule {}