import DomainEvent from '../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../shared/events/domain-event-data-attributes';
import { DefaultEventMetadata } from '../../shared/events/default-event-metadata';

export default class ClientContactCreated extends DomainEvent {
  constructor(occuredOn: Date, attributes: object, metadata?: object) {
    super('ett.client-contact.1.event.client-contact.created', occuredOn);
    this.data.attributes = attributes as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}
