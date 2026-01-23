import { Collection } from 'fireorm';
import { PaymentMethod } from 'src/payment/model/payment-method.enum';
import { PaymentType } from 'src/payment/model/payment-type.enum';

import { PaymentConfirmation } from '../../payment/model/payment-confirmation';

import { IncomeStatus } from './income-status.enum';
import { IncomeType } from './income-type.enum';

export class IncomeInfo {
  user?: string;
  title?: string;
  paymentType?: string;
}

@Collection('income')
export class Income {
  id: string;
  commerceId: string;
  bookingId: string;
  attentionId: string;
  clientId: string;
  packageId: string;
  type: IncomeType;
  amount: number;
  totalAmount: number;
  installmentNumber: number;
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
  incomeInfo: IncomeInfo;
  status: IncomeStatus;
  createdAt: Date;
  createdBy: string;
  paidAt: Date;
  paidBy: string;
  cancelledAt: Date;
  cancelledBy: string;
  paymentType?: PaymentType;
  professionalId?: string; // ID del profesional asignado
  professionalName?: string; // Nombre del profesional
  professionalCommission?: number; // Monto de comisión calculado del profesional
  professionalCommissionType?: string; // PERCENTAGE o FIXED
  professionalCommissionValue?: number; // Valor original configurado (% o monto)
  professionalCommissionNotes?: string; // Notas sobre la comisión
  commissionPaid: boolean; // false por defecto, true cuando se paga
  commissionPaymentId?: string; // ID del pago de comisión asociado
}
