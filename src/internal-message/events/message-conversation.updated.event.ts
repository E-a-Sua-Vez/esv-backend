export class MessageConversationUpdated {
  eventType = 'ett.internal-message.1.event.conversation.updated';
  aggregateId: string;
  data: {
    id: string;
    lastMessageId: string;
    lastMessageContent: string;
    lastMessageAt: Date;
    lastMessageSenderId: string;
    totalMessages: number;
    unreadCountByUser: { [userId: string]: number };
    updatedAt: Date;
  };
  metadata: {
    timestamp: Date;
    userId?: string;
  };

  constructor(timestamp: Date, conversationData: any, metadata?: any) {
    this.aggregateId = conversationData.id;
    this.data = conversationData;
    this.metadata = {
      timestamp,
      ...metadata,
    };
  }
}
