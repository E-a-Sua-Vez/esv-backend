import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { LaboratoryController } from './laboratory.controller';
import { LaboratoryService } from './laboratory.service';
import { Laboratory } from './model/laboratory.entity';

@Module({
  imports: [FireormModule.forFeature([Laboratory])],
  controllers: [LaboratoryController],
  providers: [LaboratoryService],
  exports: [LaboratoryService],
})
export class LaboratoryModule {}
