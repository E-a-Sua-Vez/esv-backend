import { Collection } from 'fireorm';
import { PaymentMethod } from 'src/payment/model/payment-method.enum';

import { PaymentConfirmation } from '../../payment/model/payment-confirmation';

import { OutcomeStatus } from './outcome-status.enum';

export class OutcomeInfo {
  user: string;
}

@Collection('outcome')
export class Outcome {
  id: string;
  commerceId: string;
  bookingId: string;
  attentionId: string;
  clientId: string;
  packageId: string;
  type: string;
  amount: number;
  totalAmount: number;
  installments: number;
  paymentMethod: PaymentMethod;
  commission: number;
  comment: string;
  fiscalNote: string;
  promotionalCode: string;
  transactionId: string;
  bankEntity: string;
  discountAmount: number;
  discountPercentage: number;
  paid: boolean;
  typeName: string;
  paymentConfirmation: PaymentConfirmation;
  outcomeInfo: OutcomeInfo;
  status: OutcomeStatus;
  createdAt: Date;
  paidAt: Date;
  paidBy: string;
  cancelledAt: Date;
  cancelledBy: string;
  createdBy: string;
  paymentType: string;
  paymentAmount: string;
  quantity: string;
  title: string;
  productId: string;
  productName: string;
  beneficiary: string;
  beneficiaryName: string;
  companyBeneficiaryId: string;
  date: Date;
  code: string;
  expireDate: Date;

  // Campos de contabilidad
  accountingPeriodId?: string; // ID del período contable
  isClosed?: boolean; // true si pertenece a un período cerrado
  closedAt?: Date; // Cuándo se cerró el período

  // Campos para refunds
  conceptType?: string; // 'PAYMENT_REFUND', 'COMMISSION_REVERSAL', 'REGULAR'
  auxiliaryId?: string; // ID de la transacción original (income/outcome)
  description?: string; // Descripción del egreso/refund
}
