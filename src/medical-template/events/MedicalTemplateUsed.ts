import { DomainEvent } from 'ett-events-lib';

export default class MedicalTemplateUsed extends DomainEvent {
  constructor(
    public occurredOn: Date,
    public data: {
      templateId: string;
      doctorId: string;
      commerceId: string;
      type: string;
    },
    public metadata?: any
  ) {
    super(occurredOn);
  }
}
