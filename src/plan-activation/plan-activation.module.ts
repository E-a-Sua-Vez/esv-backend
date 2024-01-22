import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { PlanActivationController } from './plan-activation.controller';
import { PlanActivation } from './model/plan-activation.entity';
import { PlanActivationService } from './plan-activation.service';
import { BusinessModule } from '../business/business.module';
import { PlanModule } from '../plan/plan.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    FireormModule.forFeature([PlanActivation]),
    forwardRef(() => BusinessModule),
    forwardRef(() => PlanModule),
    forwardRef(() => PaymentModule)
  ],
  providers: [PlanActivationService],
  exports: [PlanActivationService],
  controllers: [PlanActivationController],
})
export class PlanActivationModule {}