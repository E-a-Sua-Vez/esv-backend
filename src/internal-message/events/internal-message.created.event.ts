export class InternalMessageCreated {
  eventType = 'ett.internal-message.1.event.message.created';
  aggregateId: string;
  data: any;
  metadata: {
    timestamp: Date;
    userId?: string;
    userType?: string;
    commerceId?: string;
  };

  constructor(timestamp: Date, message: any, metadata?: any) {
    this.aggregateId = message.id;
    this.data = {
      id: message.id,
      type: message.type,
      category: message.category,
      priority: message.priority,
      title: message.title,
      content: message.content,
      icon: message.icon,
      actionLink: message.actionLink,
      actionLabel: message.actionLabel,
      senderId: message.senderId,
      senderType: message.senderType,
      senderName: message.senderName,
      recipientId: message.recipientId,
      recipientType: message.recipientType,
      commerceId: message.commerceId,
      commerceIds: message.commerceIds,
      conversationId: message.conversationId,
      parentMessageId: message.parentMessageId,
      attentionId: message.attentionId,
      bookingId: message.bookingId,
      queueId: message.queueId,
      productId: message.productId,
      clientId: message.clientId,
      documentId: message.documentId,
      taskId: message.taskId,
      status: message.status,
      read: message.read,
      readAt: message.readAt,
      archivedAt: message.archivedAt,
      active: message.active,
      available: message.available,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      expiresAt: message.expiresAt,
      targetAudience: message.targetAudience,
      sentCount: message.sentCount,
      readCount: message.readCount,
      clickCount: message.clickCount,
    };
    this.metadata = {
      timestamp,
      ...metadata,
    };
  }
}
