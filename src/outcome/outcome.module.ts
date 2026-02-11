import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { Outcome } from './model/outcome.entity';
import { Income } from '../income/model/income.entity';
import { OutcomeController } from './outcome.controller';
import { OutcomeService } from './outcome.service';
import { IncomeService } from '../income/income.service';
import { RefundController } from '../modules/financial/controllers/refund.controller';
import { RefundService } from '../modules/financial/services/refund.service';

@Module({
  imports: [FireormModule.forFeature([Outcome, Income])],
  providers: [OutcomeService, IncomeService, RefundService],
  exports: [OutcomeService, IncomeService, RefundService],
  controllers: [OutcomeController, RefundController],
})
export class OutcomeModule {}
