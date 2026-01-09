export class InternalMessageRead {
  eventType = 'ett.internal-message.1.event.message.read';
  aggregateId: string;
  data: {
    id: string;
    recipientId: string;
    read: boolean;
    status: string;
    readAt: Date;
  };
  metadata: {
    timestamp: Date;
    userId?: string;
  };

  constructor(
    timestamp: Date,
    messageData: { id: string; recipientId: string; read: boolean; status: string; readAt: Date },
    metadata?: any,
  ) {
    this.aggregateId = messageData.id;
    this.data = messageData;
    this.metadata = {
      timestamp,
      ...metadata,
    };
  }
}
