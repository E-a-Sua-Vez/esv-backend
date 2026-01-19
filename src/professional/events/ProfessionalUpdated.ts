import { Professional } from '../model/professional.entity';

export default class ProfessionalUpdated {
  constructor(
    public readonly occurredOn: Date,
    public readonly data: Professional,
    public readonly metadata: { user: string }
  ) {}
}
