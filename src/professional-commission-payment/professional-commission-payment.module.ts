import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { IncomeModule } from '../income/income.module';
import { OutcomeModule } from '../outcome/outcome.module';

import { ProfessionalCommissionPayment } from './model/professional-commission-payment.entity';
import { ProfessionalCommissionPaymentService } from './professional-commission-payment.service';
import { ProfessionalCommissionPaymentController } from './professional-commission-payment.controller';

@Module({
  imports: [
    FireormModule.forFeature([ProfessionalCommissionPayment]),
    IncomeModule,
    OutcomeModule,
  ],
  providers: [ProfessionalCommissionPaymentService],
  controllers: [ProfessionalCommissionPaymentController],
  exports: [ProfessionalCommissionPaymentService],
})
export class ProfessionalCommissionPaymentModule {}
