import { Collection } from 'fireorm';

import { MessageCategory } from '../../internal-message/model/message-category.enum';

@Collection('system-notification-tracking')
export class SystemNotificationTracking {
  id: string;
  commerceId: string;
  category: MessageCategory; // LOW_STOCK | EXPIRING_BATCH
  entityType: 'product' | 'batch';
  entityId: string; // productId o batchId

  // Control de repetición
  firstDetectedAt: Date;
  lastSentAt: Date;
  sentCount: number;
  nextAllowedSendAt: Date; // Calculado según estrategia
  maxSent: boolean; // Llegó al límite de envíos

  // Resolución
  resolved: boolean;
  resolvedAt?: Date;

  // Metadata para decisiones
  lastKnownData: {
    currentStock?: number;
    minStock?: number;
    expiryDate?: string;
    daysToExpiry?: number;
    batchNumber?: string;
    productName?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}
