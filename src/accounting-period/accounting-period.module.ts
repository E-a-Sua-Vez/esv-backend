import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { AccountingPeriodController } from './accounting-period.controller';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingPeriod } from './model/accounting-period.entity';
import { IncomeModule } from '../income/income.module';
import { OutcomeModule } from '../outcome/outcome.module';

@Module({
  imports: [
    FireormModule.forFeature([AccountingPeriod]),
    forwardRef(() => IncomeModule),
    forwardRef(() => OutcomeModule),
  ],
  providers: [AccountingPeriodService],
  exports: [AccountingPeriodService],
  controllers: [AccountingPeriodController],
})
export class AccountingPeriodModule {}
