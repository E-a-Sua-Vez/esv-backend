import { PaymentMethod } from './payment-method.enum';
import { PaymentType } from './payment-type.enum';

export class PaymentConfirmation {
  bankEntity: string;
  procedureNumber: number;
  proceduresTotalNumber: number;
  transactionId: string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  installments: number;
  paid: boolean;
  totalAmount: number;
  paymentAmount: number;
  paymentPercentage: number;
  paymentDate: Date;
  paymentCommission: number;
  paymentComment: string;
  paymentFiscalNote: string;
  promotionalCode: string;
  user: string;
}