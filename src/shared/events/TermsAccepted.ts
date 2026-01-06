import DomainEvent from './domain-event';
import { DefaultEventMetadata } from './default-event-metadata';
import { DomainEventDataAttributes } from './domain-event-data-attributes';

export default class TermsAccepted extends DomainEvent {
  constructor(occurredOn: Date, attributes: object, metadata?: object) {
    super('ett.terms.1.event.terms.accepted', occurredOn);
    this.data.attributes = attributes as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}













