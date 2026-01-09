import { Collection } from 'fireorm';

import { MessageCategory } from './message-category.enum';
import { MessagePriority } from './message-priority.enum';
import { MessageStatus } from './message-status.enum';
import { MessageType } from './message-type.enum';

@Collection('internal-message')
export class InternalMessage {
  id: string;

  // Clasificación
  type: MessageType;
  category: MessageCategory;
  priority: MessagePriority;

  // Contenido
  title: string;
  content: string;
  icon?: string;
  actionLink?: string;
  actionLabel?: string;

  // Remitente
  senderId?: string | { id: string; email?: string; name?: string }; // null para mensajes del sistema, objeto con info para enriquecer
  senderType?: 'master' | 'business' | 'collaborator' | 'system';
  senderName?: string; // Cache del nombre

  // Destinatario(s)
  recipientId: string; // Usuario específico
  recipientType: 'master' | 'business' | 'collaborator' | 'client';

  // Contexto (para filtrar/agrupar)
  commerceId?: string; // null para mensajes master
  commerceIds?: string[]; // Para broadcast a múltiples commerces

  // Conversación (para chat)
  conversationId?: string; // Agrupa mensajes de una conversación
  parentMessageId?: string; // Para replies/threads

  // Contexto de negocio (referencias)
  attentionId?: string;
  bookingId?: string;
  queueId?: string;
  productId?: string;
  clientId?: string;
  documentId?: string;
  taskId?: string;

  // Estado
  status: MessageStatus;
  read: boolean; // Duplicado por compatibilidad
  readAt?: Date;
  archivedAt?: Date;

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date; // Para mensajes temporales

  // Broadcast metadata (solo para type=broadcast)
  targetAudience?: {
    allBusinesses?: boolean;
    allCollaborators?: boolean;
    commerceIds?: string[];
    businessIds?: string[];
    planTypes?: string[];
  };

  // Analytics (para broadcasts/anuncios)
  sentCount?: number; // Cuántos usuarios recibieron
  readCount?: number; // Cuántos lo leyeron
  clickCount?: number; // Cuántos hicieron click en acción
}
