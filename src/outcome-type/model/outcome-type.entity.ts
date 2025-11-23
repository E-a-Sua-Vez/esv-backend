import { Collection } from 'fireorm';

import { OutcomeTypeType } from './outcome-type-type.enum';

@Collection('outcome-type')
export class OutcomeType {
  id: string;
  commerceId: string;
  name: string;
  tag: string;
  active: boolean;
  available: boolean;
  type: OutcomeTypeType;
  createdAt: Date;
}
