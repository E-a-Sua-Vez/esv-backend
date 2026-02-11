import { Collection } from 'fireorm';
import { AccountingPeriodStatus } from './accounting-period-status.enum';

export interface PeriodTotals {
  totalIncomes: number;
  totalOutcomes: number;
  totalCommissions: number;
  totalRefunds: number;
  totalCommissionReversals: number;
  netAmount: number;
  incomesCount: number;
  outcomesCount: number;
}

export interface ReconciliationData {
  bankBalance?: number;
  systemBalance?: number;
  difference?: number;
  notes?: string;
}

@Collection('accountingPeriod')
export class AccountingPeriod {
  id: string;

  // Información básica
  name: string; // "Enero 2026"
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;

  // Totales calculados al cerrar
  totals: PeriodTotals;

  // Control de cambios
  createdBy: string;
  createdAt: Date;

  closedBy?: string;
  closedAt?: Date;

  lockedBy?: string;
  lockedAt?: Date;

  reopenedBy?: string;
  reopenedAt?: Date;

  // Metadata adicional
  notes?: string;
  reconciliationData?: ReconciliationData;

  // Auditoría
  commerceId: string;
}
