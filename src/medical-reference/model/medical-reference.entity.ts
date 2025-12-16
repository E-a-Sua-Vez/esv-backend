import { Collection } from 'fireorm';

export enum ReferenceStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ATTENDED = 'attended',
  CANCELLED = 'cancelled',
}

export enum ReferenceUrgency {
  ROUTINE = 'routine',
  PREFERRED = 'preferred',
  URGENT = 'urgent',
}

@Collection('medical-reference')
export class MedicalReference {
  id: string;
  commerceId: string;
  clientId: string;
  attentionId: string;
  patientHistoryId?: string;

  // Médico origen
  doctorOriginId: string;
  doctorOriginName: string;

  // Médico destino (opcional si se especifica especialidad)
  doctorDestinationId?: string;
  doctorDestinationName?: string;
  specialtyDestination: string; // Especialidad destino

  // Información de la referencia
  reason: string;
  presumptiveDiagnosis?: string;
  studiesPerformed?: string;
  currentTreatment?: string;
  urgency: ReferenceUrgency;
  status: ReferenceStatus;

  // Fechas
  referenceDate: Date;
  acceptedAt?: Date;
  attendedAt?: Date;

  // Respuesta
  response?: string;
  returnReport?: string; // Informe de retorno del especialista

  // Documentos adjuntos
  attachedDocuments?: string[];

  // PDF
  pdfUrl?: string; // URL del PDF generado

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
