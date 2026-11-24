/**
 * File Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService]
})
export class FileModule {}