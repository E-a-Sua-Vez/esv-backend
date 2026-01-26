import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { IncomeModule } from '../income/income.module';
import { OutcomeModule } from '../outcome/outcome.module';
import { ProfessionalModule } from '../professional/professional.module';
import { CommerceModule } from '../commerce/commerce.module';
import { ClientModule } from '../client/client.module';

import { ProfessionalCommissionPayment } from './model/professional-commission-payment.entity';
import { ProfessionalCommissionPaymentService } from './professional-commission-payment.service';
import { ProfessionalCommissionPaymentController } from './professional-commission-payment.controller';
import { ProfessionalCommissionPaymentPdfService } from './professional-commission-payment-pdf.service';

@Module({
  imports: [
    FireormModule.forFeature([ProfessionalCommissionPayment]),
    IncomeModule,
    OutcomeModule,
    ProfessionalModule,
    CommerceModule,
    ClientModule,
  ],
  providers: [ProfessionalCommissionPaymentService, ProfessionalCommissionPaymentPdfService],
  controllers: [ProfessionalCommissionPaymentController],
  exports: [ProfessionalCommissionPaymentService, ProfessionalCommissionPaymentPdfService],
})
export class ProfessionalCommissionPaymentModule {}
