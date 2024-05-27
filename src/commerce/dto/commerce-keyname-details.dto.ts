import { LocaleInfo, ServiceInfo, ContactInfo } from '../model/commerce.entity';
import { Queue } from '../../queue/model/queue.entity';
import { SurveyPersonalized } from 'src/survey-personalized/model/survey-personalized.entity';
import { FeatureToggleDetailsDto } from '../../feature-toggle/dto/feature-toggle-details.dto';

export class CommerceKeyNameDetailsDto {
  id: string;
  name: string;
  keyName: string;
  logo: string;
  active: boolean;
  available: boolean;
  category: string;
  tag: string;
  email: string;
  localeInfo: LocaleInfo;
  serviceInfo: ServiceInfo;
  contactInfo: ContactInfo;
  queues: Queue[];
  features: FeatureToggleDetailsDto[];
  surveys: SurveyPersonalized[];
}