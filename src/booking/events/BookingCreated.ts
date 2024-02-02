import DomainEvent from '../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../shared/events/domain-event-data-attributes';
import { DefaultEventMetadata } from '../../shared/events/default-event-metadata';

export default class BookingCreated extends DomainEvent {
  constructor(occuredOn: Date, attributes: object, metadata?: object) {
    super('ett.booking.1.event.booking.created', occuredOn);
    this.data.attributes = attributes as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}
