import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { Payment } from './model/payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [FireormModule.forFeature([Payment])],
  providers: [PaymentService],
  exports: [PaymentService],
  controllers: [PaymentController],
})
export class PaymentModule {}
