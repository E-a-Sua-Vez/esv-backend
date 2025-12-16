import { Collection } from 'fireorm';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { User } from 'src/user/model/user.entity';

import { AttentionStatus } from './attention-status.enum';

export class Block {
  number: number;
  hourFrom: string;
  hourTo: string;
  blocks?: Block[];
  blockNumbers?: number[];
}

@Collection('attention')
export class Attention {
  id: string;
  commerceId: string;
  collaboratorId: string;
  serviceId: string;
  servicesId: string[];
  createdAt: Date;
  endAt: Date;
  number: number;
  queueId: string;
  status: AttentionStatus;
  userId: string;
  userName?: string;
  userLastName?: string;
  clientId: string;
  moduleId: string;
  comment: string;
  surveyId: string;
  reactivatedAt: Date;
  reactivated: boolean;
  duration: number;
  type: string;
  assistingCollaboratorId: string;
  notificationOn = false;
  notificationEmailOn = false;
  channel: string;
  user: User;
  ratedAt: Date;
  rateDuration: number;
  cancelled: boolean;
  cancelledAt: Date;
  transfered: boolean;
  transferedAt: Date;
  transferedOrigin: string;
  transferedBy: string;
  paidAt: Date;
  paid: boolean;
  paymentConfirmationData?: PaymentConfirmation;
  confirmed: boolean;
  confirmedAt: Date;
  processedAt: Date;
  confirmedBy: string;
  bookingId: string;
  patientHistoryId?: string; // Link to PatientHistory record
  controlId?: string; // If this attention is from a control/comeback
  originalAttentionId?: string; // If this is a comeback, link to original attention
  block?: Block;
  servicesDetails: object[];
  packageId?: string;
  packageProcedureNumber?: number;
  packageProceduresTotalNumber?: number;
  termsConditionsToAcceptCode?: string;
  termsConditionsAcceptedCode?: string;
  termsConditionsToAcceptedAt?: Date;
  surveyPostAttentionDateScheduled?: string;
  notificationSurveySent = false;
  telemedicineSessionId?: string; // ID de la sesión de telemedicina asociada
  telemedicineConfig?: {
    type: string;
    scheduledAt: Date | string;
    recordingEnabled?: boolean;
    notes?: string;
  }; // Configuración de telemedicina para mostrar en detalles
  telemedicineInfo?: {
    patientConnectedAt?: Date | string;
    doctorConnectedAt?: Date | string;
    endedAt?: Date | string;
    endedBy?: string;
    duration?: number; // Duración en minutos
  }; // Información de tracking de la sesión de telemedicina
}
