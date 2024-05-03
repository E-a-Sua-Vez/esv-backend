import DomainEvent from '../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../shared/events/domain-event-data-attributes';
import { DefaultEventMetadata } from '../../shared/events/default-event-metadata';
import { v4 as uuidv4 } from 'uuid';

export default class BusinessWhatsappConnectionDisconnected extends DomainEvent {
  constructor(occuredOn: Date, attributes: object, metadata?: object) {
    super('ett.business.1.event.whatsapp-connection.disconnected', occuredOn);
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
