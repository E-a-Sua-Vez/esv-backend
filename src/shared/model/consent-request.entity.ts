import { Collection } from 'fireorm';
import { ConsentType } from './lgpd-consent.entity';

/**
 * Status de una solicitud de consentimiento
 */
export enum ConsentRequestStatus {
  PENDING = 'PENDING', // Pendiente
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED', // Parcialmente completado
  COMPLETED = 'COMPLETED', // Completado
  EXPIRED = 'EXPIRED', // Expirado
}

/**
 * Entidad de solicitud de consentimiento
 * Representa una solicitud enviada al cliente para obtener consentimientos
 */
@Collection('consent-request')
export class ConsentRequest {
  id: string;

  // Identificación
  commerceId: string;
  clientId: string;

  // Token único para el link
  token: string; // UUID
  expiresAt: Date; // Fecha de expiración del token

  // Consentimientos solicitados
  requestedConsents: ConsentType[]; // Tipos de consentimiento solicitados

  // Estado
  status: ConsentRequestStatus;
  requestedAt: Date; // Cuándo se solicitó
  requestedBy: string; // ID del colaborador/usuario que solicitó
  completedAt?: Date; // Cuándo se completó

  // Recordatorios
  remindersSent: number; // Cantidad de recordatorios enviados
  lastReminderAt?: Date; // Último recordatorio enviado

  // Tracking
  viewedAt?: Date; // Cliente abrió el link
  ipAddress?: string; // IP desde donde se completó
  userAgent?: string; // User agent del navegador

  // QR Code (opcional, para armazenar quando gerado)
  qrCodeBase64?: string; // Base64 do QR code (sem data URL prefix)
  qrCodeGeneratedAt?: Date; // Quando foi gerado

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}





