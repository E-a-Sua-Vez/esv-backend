import { v4 as uuidv4 } from 'uuid';

import { DomainEventDataAttributes } from './domain-event-data-attributes';

export class DomainEventData {
  constructor() {
    this.id = uuidv4().toString();
  }
  id: string;
  type: string;
  occurredOn: Date;
  attributes: DomainEventDataAttributes;
}
