import DomainEvent from '../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../shared/events/domain-event-data-attributes';
import { DefaultEventMetadata } from '../../shared/events/default-event-metadata';

export default class ServiceCreated extends DomainEvent {
  constructor(occuredOn: Date, attributes: object, metadata?: object) {
    super('ett.service.1.event.service.created', occuredOn);
    this.data.attributes = attributes as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}
