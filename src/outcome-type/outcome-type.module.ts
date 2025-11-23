import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { OutcomeType } from './model/outcome-type.entity';
import { OutcomeTypeController } from './outcome-type.controller';
import { OutcomeTypeService } from './outcome-type.service';

@Module({
  imports: [FireormModule.forFeature([OutcomeType])],
  providers: [OutcomeTypeService],
  exports: [OutcomeTypeService],
  controllers: [OutcomeTypeController],
})
export class OutcomeTypeModule {}
