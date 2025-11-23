import { HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import PaymentCreated from './events/PaymentCreated';
import { BankAccount } from './model/bank-account';
import { PaymentMethod } from './model/payment-method.enum';
import { Payment } from './model/payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository = getRepository(Payment),
    @Inject(GcpLoggerService)
    private readonly logger: GcpLoggerService
  ) {
    this.logger.setContext('PaymentService');
  }

  public async getPaymentById(id: string): Promise<Payment> {
    return await this.paymentRepository.findById(id);
  }

  public async createPayment(
    user: string,
    businessId: string,
    planId: string,
    amount: number,
    paymentNumber: string,
    paymentDate: Date,
    bankData: BankAccount,
    method: PaymentMethod
  ): Promise<Payment> {
    const payment = new Payment();
    if (!businessId || !planId || amount === undefined || !paymentNumber) {
      this.logger.warn('Payment creation failed: Missing required fields', {
        businessId,
        planId,
        amount,
        paymentNumber,
        user,
      });
      throw new HttpException(`No hay suficientes crear el pago`, HttpStatus.BAD_REQUEST);
    }
    if (amount < 0) {
      this.logger.warn('Payment creation failed: Invalid amount', {
        amount,
        businessId,
        planId,
        user,
      });
      throw new HttpException(`Monto debe ser mayor a 0`, HttpStatus.BAD_REQUEST);
    }
    payment.businessId = businessId;
    payment.planId = planId;
    payment.amount = amount;
    payment.paymentNumber = paymentNumber;
    payment.paymentDate = paymentDate;
    payment.bankData = bankData;
    payment.createdAt = new Date();
    payment.method = method;
    const paymentCreated = await this.paymentRepository.create(payment);
    const paymentCreatedEvent = new PaymentCreated(new Date(), paymentCreated, { user });
    publish(paymentCreatedEvent);
    this.logger.info('Payment created successfully', {
      paymentId: paymentCreated.id,
      businessId,
      planId,
      amount,
      paymentNumber,
      method,
      user,
    });
    return paymentCreated;
  }
}
