import { Collection } from 'fireorm';
import { PaymentMethod } from 'src/payment/model/payment-method.enum';

import { CommissionPaymentStatus } from './commission-payment-status.enum';

@Collection('professionalCommissionPayment')
export class ProfessionalCommissionPayment {
  id: string;
  commerceId: string;
  businessId: string;
  professionalId: string;

  // Incomes relacionados
  incomeIds: string[];

  // Resumen financiero
  totalIncomes: number;
  totalAmount: number;
  totalCommission: number;

  // Detalles adicionales
  periodFrom: Date;
  periodTo: Date;

  // Estado del pago
  status: CommissionPaymentStatus;

  // Información de creación
  createdAt: Date;
  createdBy: string;
  notes: string;

  // Información de pago (cuando se confirma)
  paidAt?: Date;
  paidBy?: string;
  paymentNotes?: string;
  paymentMethod?: PaymentMethod;
  outcomeId?: string;

  // Información de cancelación
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;

  // Metadata
  updatedAt?: Date;
  updatedBy?: string;
}
