import { Collection } from 'fireorm';
import { QuestionType } from './question-type.enum';
import { SurveyType } from './type.enum';

export class Question {
  title: string;
  type: QuestionType;
  description: string;
  options: string[];
  order: number;
  active: boolean;
  analize?: boolean;
  otherOption?: boolean;
  otherOptionOpen?: boolean;
}

@Collection('survey-personalized')
export class SurveyPersonalized {
  id: string;
  type: SurveyType;
  commerceId?: string;
  queueId?: string;
  questions?: Question[];
  active: boolean;
  attentionDefault: boolean;
  hasCSAT: boolean;
  hasNPS: boolean;
  hasMessage: boolean;
  createdAt: Date;
  modifiedAt: Date;
  available: boolean;
}