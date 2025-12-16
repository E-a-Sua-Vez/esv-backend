import { Collection } from 'fireorm';

export enum TelemedicineSessionType {
  VIDEO = 'video',
  CHAT = 'chat',
  BOTH = 'both',
}

export enum TelemedicineSessionStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Collection('telemedicine-session')
export class TelemedicineSession {
  id: string;
  commerceId: string;
  clientId: string;
  doctorId: string;
  attentionId?: string; // Si está asociada a una atención
  patientHistoryId?: string; // Si está asociada al historial

  // Tipo y estado
  type: TelemedicineSessionType;
  status: TelemedicineSessionStatus;

  // Fechas
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  endedBy?: string; // ID del doctor que cerró la sesión
  duration?: number; // Duración en minutos
  patientConnectedAt?: Date; // Cuando el paciente se conectó
  doctorConnectedAt?: Date; // Cuando el doctor se conectó
  lastActivityAt?: Date; // Última actividad en la sesión (para timeout)

  // Información de la sala
  roomId: string; // ID único de la sala (para WebRTC)
  roomName?: string; // Nombre descriptivo de la sala
  connectedUsers?: string[]; // IDs de usuarios actualmente conectados a la sala
  connectedDoctorId?: string; // ID del doctor conectado (si hay uno)
  connectedPatientId?: string; // ID del paciente conectado (si hay uno)
  lastRoomActivityAt?: Date; // Última actividad en la sala (para estado persistido)

  // Grabación
  recordingEnabled: boolean;
  recordingUrl?: string; // URL de la grabación en S3
  consentGiven: boolean; // Consentimiento del paciente para grabación
  consentGivenAt?: Date;

  // Notas y observaciones
  notes?: string;
  diagnosis?: string; // Diagnóstico realizado
  prescriptionId?: string; // Si se creó una prescripción

  // Security
  accessKey?: string; // Clave de acceso única para el cliente (plaintext, legacy support)
  accessKeyHash?: string; // Hash de la clave de acceso (SHA-256) para validación segura
  accessKeySent?: boolean; // Si la clave ya fue enviada
  accessKeySentAt?: Date; // Cuándo se envió la clave
  accessKeyValidated?: boolean; // Si el cliente validó la clave
  accessKeyValidatedAt?: Date; // Cuándo se validó la clave
  accessKeyValidationAttempts?: number; // Número de intentos fallidos de validación
  accessKeyLockedUntil?: Date; // Bloqueo temporal después de múltiples intentos fallidos

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
