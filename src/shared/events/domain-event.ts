import { DomainEventData } from './domain-event-data';

export default class DomainEvent {
  constructor(type: string, occurredOn: Date) {
    this.data = new DomainEventData();
    this.data.type = type;
    this.data.occurredOn = occurredOn;
  }

  data: DomainEventData;

  metadata: object;
}
