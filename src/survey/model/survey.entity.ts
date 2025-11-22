import { Collection } from 'fireorm';
import { Question } from 'src/survey-personalized/model/survey-personalized.entity';

import { MessageEntitiesDto } from './message.entites.dto';
import { SurveyType } from './type.enum';

@Collection('survey')
export class Survey {
  id: string;
  personalizedId?: string;
  type: SurveyType;
  attentionId: string;
  commerceId: string;
  collaboratorId: string;
  queueId: string;
  userId: string;
  rating?: number;
  nps?: number;
  message: string;
  messageScore?: number;
  messageEntities?: MessageEntitiesDto;
  questions?: Question[];
  answers?: object[];
  contacted?: boolean;
  contactedDate?: Date;
  createdAt: Date;
}
