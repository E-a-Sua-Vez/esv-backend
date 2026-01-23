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
  collaboratorId?: string; // ID del colaborador que emite la referencia (DEPRECATED: usar professionalId)
  professionalId?: string; // ID del profesional que emite la referencia

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
  documentHash?: string; // Hash SHA-256 del documento para verificación de integridad

  // Assinatura digital ICP-Brasil (conformidade CFM)
  signedAt?: Date; // Data da assinatura
  signedBy?: string; // ID do usuário que assinou
  digitalSignature?: string; // Assinatura digital PKCS#7 (Base64)
  certificateInfo?: {
    issuer: string;
    subject: string;
    serialNumber: string;
    validFrom: Date;
    validTo: Date;
  };
  isSigned?: boolean; // Indica se o documento está assinado (bloqueado para edição)

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
