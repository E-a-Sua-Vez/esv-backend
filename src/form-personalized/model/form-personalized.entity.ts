import { Collection } from 'fireorm';

import { QuestionType } from './question-type.enum';
import { FormType } from './type.enum';

export class Question {
  title: string;
  type: QuestionType;
  description: string;
  options: string[];
  order: number;
  active: boolean;
  item?: string;
  analize?: boolean;
  otherOption?: boolean;
  otherOptionOpen?: boolean;
  patientHistoryItem?: string;
}

@Collection('form-personalized')
export class FormPersonalized {
  id: string;
  type: FormType;
  commerceId?: string;
  queueId?: string;
  servicesId?: string[];
  questions?: Question[];
  active: boolean;
  createdAt: Date;
  modifiedAt: Date;
  available: boolean;
}
