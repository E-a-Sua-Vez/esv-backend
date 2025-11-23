import { v4 as uuidv4 } from 'uuid';

import { DefaultEventMetadata } from '../../shared/events/default-event-metadata';
import DomainEvent from '../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../shared/events/domain-event-data-attributes';

export default class BusinessWhatsappConnectionCreated extends DomainEvent {
  constructor(occuredOn: Date, attributes: object, metadata?: object) {
    super('ett.business.1.event.whatsapp-connection.created', occuredOn);
    if (!attributes['id']) {
      attributes['id'] = uuidv4().toString();
    }
    this.data.attributes = attributes as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}
