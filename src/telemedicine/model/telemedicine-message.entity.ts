import { Collection } from 'fireorm';

export enum MessageSenderType {
  DOCTOR = 'doctor',
  PATIENT = 'patient',
  SYSTEM = 'system',
}

@Collection('telemedicine-message')
export class TelemedicineMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: MessageSenderType;
  senderName?: string; // Nombre del remitente

  // Contenido
  message: string;
  timestamp: Date;

  // Archivos adjuntos
  attachments?: Array<{
    type: 'image' | 'document' | 'video';
    url: string;
    name: string;
    size?: number;
  }>;

  // Metadata
  read: boolean;
  readAt?: Date;
  active: boolean;
  available: boolean;
  createdAt: Date;
}
