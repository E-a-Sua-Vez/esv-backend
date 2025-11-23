import { Collection } from 'fireorm';
import { Question } from 'src/form-personalized/model/form-personalized.entity';

import { FormType } from './type.enum';

@Collection('form')
export class Form {
  id: string;
  personalizedId?: string;
  type: FormType;
  bookingId: string;
  attentionId: string;
  commerceId: string;
  queueId: string;
  clientId: string;
  servicesId?: string[];
  questions?: Question[];
  answers?: object[];
  createdAt: Date;
}
