import { Collection } from 'fireorm';

@Collection('message-conversation')
export class MessageConversation {
  id: string;

  // Participantes (ordenados alfabéticamente para consistencia)
  participantIds: string[];

  // Metadata de participantes
  participants: Array<{
    userId: string;
    userType: string;
    userName: string;
    lastReadAt?: Date;
  }>;

  // Contexto
  commerceId: string; // Ambos usuarios deben pertenecer

  // Último mensaje
  lastMessageId?: string;
  lastMessageContent?: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string | { id: string; email?: string; name?: string };

  // Contadores
  totalMessages: number;
  unreadCountByUser: { [userId: string]: number };

  // Estado
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
