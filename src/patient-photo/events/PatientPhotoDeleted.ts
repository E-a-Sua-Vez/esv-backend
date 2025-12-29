import { DefaultEventMetadata } from '../../shared/events/default-event-metadata';
import DomainEvent from '../../shared/events/domain-event';
import { DomainEventDataAttributes } from '../../shared/events/domain-event-data-attributes';

export default class PatientPhotoDeleted extends DomainEvent {
  constructor(occuredOn: Date, attributes: object, metadata?: object) {
    super('ett.patient-photo.1.event.patient-photo.deleted', occuredOn);
    this.data.attributes = attributes as DomainEventDataAttributes;
    if (metadata) {
      this.metadata = { ...new DefaultEventMetadata(), ...metadata };
    } else {
      this.metadata = new DefaultEventMetadata();
    }
  }
}












