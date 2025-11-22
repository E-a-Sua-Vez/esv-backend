import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { Income } from './model/income.entity';

@Module({
  imports: [FireormModule.forFeature([Income])],
  providers: [IncomeService],
  exports: [IncomeService],
  controllers: [IncomeController],
})
export class IncomeModule {}
