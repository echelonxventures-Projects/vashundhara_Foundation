import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module';
import { PlatformStructureController, StructureController, StructureGate } from './manage';
import { DonationDetailsController, FormsController, RecordsController } from './records';
import { RulesService } from './rules';

@Module({ imports: [SystemModule], controllers: [StructureController, PlatformStructureController, RecordsController, DonationDetailsController, FormsController], providers: [StructureGate, RulesService] })
export class StructureModule {}
