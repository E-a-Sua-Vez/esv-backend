import { DefaultEventMetadata } from '../../../shared/events/default-event-metadata';
import DomainEvent from '../../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../../shared/events/domain-event-data-attributes';

export class RefundProcessed extends DomainEvent {
  constructor(
    occurredOn: Date,
    public readonly refundId: string,
    public readonly originalTransactionId: string,
    public readonly amount: number,
    public readonly type: string,
    public readonly commerceId: string,
    public readonly clientId: string,
    public readonly beneficiary: string,
    public readonly reason: string,
    metadata?: object
  ) {
    super('ett.financial.1.event.refund.processed', occurredOn);
    this.data.attributes = {      id: refundId,      refundId,
      originalTransactionId,
      amount,
      type,
      commerceId,
      clientId,
      beneficiary,
      reason,
    } as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}
