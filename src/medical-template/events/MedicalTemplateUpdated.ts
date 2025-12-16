import { DomainEvent } from 'ett-events-lib';

import { MedicalTemplate } from '../model/medical-template.entity';

export default class MedicalTemplateUpdated extends DomainEvent {
  constructor(public occurredOn: Date, public data: MedicalTemplate, public metadata?: any) {
    super(occurredOn);
  }
}
