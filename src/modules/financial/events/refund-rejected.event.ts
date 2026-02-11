import { DefaultEventMetadata } from '../../../shared/events/default-event-metadata';
import DomainEvent from '../../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../../shared/events/domain-event-data-attributes';

export class RefundRejected extends DomainEvent {
  constructor(
    date: Date,
    public readonly refundId: string,
    public readonly commerceId: string,
    public readonly amount: number,
    public readonly reason: string,
    metadata?: object
  ) {
    super('ett.financial.1.event.refund.rejected', date);
    this.data.attributes = {
      id: refundId,
      refundId,
      commerceId,
      amount,
      reason,
    } as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}
