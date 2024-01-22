import { Payment } from './model/payment.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import PaymentCreated from './events/PaymentCreated';
import { HttpException, HttpStatus } from '@nestjs/common';
import { BankAccount } from './model/bank-account';
import { PaymentMethod } from './model/payment-method.enum';

export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository = getRepository(Payment)
  ) {}

  public async getPaymentById(id: string): Promise<Payment> {
    return await this.paymentRepository.findById(id);
  }

  public async createPayment(user: string, businessId: string, planId: string, amount: number, paymentNumber: string, paymentDate: Date, bankData: BankAccount, method: PaymentMethod): Promise<Payment> {
    let payment = new Payment();
    if (!businessId || !planId || amount === undefined || !paymentNumber) {
      throw new HttpException(`No hay suficientes crear el pago`, HttpStatus.BAD_REQUEST);
    }
    if (amount < 0) {
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
    return paymentCreated;
  }
}
