import { Professional } from '../model/professional.entity';

export default class ProfessionalCreated {
  constructor(
    public readonly occurredOn: Date,
    public readonly data: Professional,
    public readonly metadata: { user: string }
  ) {}
}
