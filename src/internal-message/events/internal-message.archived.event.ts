export class InternalMessageArchived {
  eventType = 'ett.internal-message.1.event.message.archived';
  aggregateId: string;
  data: {
    id: string;
    status: string;
    archivedAt: Date;
  };
  metadata: {
    timestamp: Date;
    userId?: string;
  };

  constructor(
    timestamp: Date,
    messageData: { id: string; status: string; archivedAt: Date },
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
