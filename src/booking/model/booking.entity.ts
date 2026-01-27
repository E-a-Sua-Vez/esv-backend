import { Collection } from 'fireorm';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { User } from 'src/user/model/user.entity';

export class Block {
  number: number;
  hourFrom: string;
  hourTo: string;
  blocks?: Block[];
  blockNumbers?: number[];
}

@Collection('booking')
export class Booking {
  id: string;
  clientId: string;
  commerceId: string;
  queueId: string;
  number: number;
  date: string;
  dateFormatted: Date;
  createdAt: Date;
  type: string;
  channel: string;
  status: string;
  userId: string;
  comment: string;
  processedAt: Date;
  processed: boolean;
  cancelledAt: Date;
  cancelled: boolean;
  attentionId: string;
  transfered: boolean;
  transferedAt: Date;
  transferedOrigin: string;
  transferedCount: number;
  transferedBy: string;
  edited: boolean;
  editedAt: Date;
  editedDateOrigin: string;
  editedBlockOrigin: Block;
  editedCount: number;
  editedBy: string;
  user: User;
  block?: Block;
  professionalId?: string; // ID del profesional asignado a la reserva
  professionalName?: string; // Nombre del profesional asignado (desnormalizado para consultas rápidas)
  professionalCommissionType?: string; // Tipo de comisión del profesional: 'PERCENTAGE' o 'FIXED'
  professionalCommissionValue?: number; // Valor de comisión del profesional (% o monto)
  professionalCommissionAmount?: number; // Monto calculado de comisión
  professionalCommissionNotes?: string; // Notas sobre la comisión
  confirmedAt: Date;
  servicesId: string[];
  confirmed: boolean;
  confirmationData?: PaymentConfirmation;
  confirmedBy: string;
  confirmNotified = false;
  confirmNotifiedEmail = false;
  confirmNotifiedWhatsapp = false;
  servicesDetails: object[];
  packageId?: string;
  packageProcedureNumber?: number;
  packageProceduresTotalNumber?: number;
  termsConditionsToAcceptCode?: string;
  termsConditionsAcceptedCode?: string;
  termsConditionsToAcceptedAt?: Date;
  telemedicineSessionId?: string; // ID de sesión de telemedicina si aplica
  telemedicineConfig?: {
    type: 'video' | 'chat' | 'both';
    scheduledAt: Date;
    recordingEnabled?: boolean;
    notes?: string;
  };
}
