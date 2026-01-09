export class MessageConversationCreated {
  eventType = 'ett.internal-message.1.event.conversation.created';
  aggregateId: string;
  data: any;
  metadata: {
    timestamp: Date;
    userId?: string;
  };

  constructor(timestamp: Date, conversation: any, metadata?: any) {
    this.aggregateId = conversation.id;
    this.data = {
      id: conversation.id,
      participantIds: conversation.participantIds,
      participants: conversation.participants,
      commerceId: conversation.commerceId,
      active: conversation.active,
      createdAt: conversation.createdAt,
    };
    this.metadata = {
      timestamp,
      ...metadata,
    };
  }
}
