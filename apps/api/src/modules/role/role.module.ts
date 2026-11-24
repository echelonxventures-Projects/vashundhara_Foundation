/**
 * Role Module for Vashundhara Foundation API
 */

import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';

import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [PrismaModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService]
})
export class RoleModule {}