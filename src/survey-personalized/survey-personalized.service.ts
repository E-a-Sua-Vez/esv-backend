import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import SurveyPersonalizedCreated from './events/SurveyPersonalizedCreated';
import SurveyPersonalizedUpdated from './events/SurveyPersonalizedUpdated';
import { Question, SurveyPersonalized } from './model/survey-personalized.entity';
import { SurveyType } from './model/type.enum';

export class SurveyPersonalizedService {
  constructor(
    @InjectRepository(SurveyPersonalized)
    private surveyPersonalizedRepository = getRepository(SurveyPersonalized)
  ) {}

  public async getSurveyPersonalizedById(id: string): Promise<SurveyPersonalized> {
    return await this.surveyPersonalizedRepository.findById(id);
  }

  public async getSurveysPersonalized(): Promise<SurveyPersonalized[]> {
    return await this.surveyPersonalizedRepository.find();
  }

  public async getSurveysPersonalizedByCommerceId(
    commerceId: string
  ): Promise<SurveyPersonalized[]> {
    const surveys: SurveyPersonalized[] = await this.surveyPersonalizedRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('available', true)
      .find();
    const surveysToReturn = [];
    if (surveys && surveys.length > 0) {
      surveys.forEach(survey => {
        let questions = survey.questions;
        if (questions && questions.length > 0) {
          questions = questions.sort((a, b) => a.order - b.order);
          survey.questions = questions;
          surveysToReturn.push(survey);
        }
      });
    }
    return surveys;
  }

  public async getSurveysPersonalizedByQueueId(
    commerceId: string,
    queueId: string
  ): Promise<SurveyPersonalized[]> {
    const surveys: SurveyPersonalized[] = await this.surveyPersonalizedRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .find();
    const surveysToReturn = [];
    if (surveys && surveys.length > 0) {
      surveys.forEach(survey => {
        let questions = survey.questions;
        if (questions && questions.length > 0) {
          questions = questions.sort((a, b) => a.order - b.order);
          survey.questions = questions;
          surveysToReturn.push(survey);
        }
      });
    }
    return surveys;
  }

  public async createSurveyPersonalized(
    commerceId: string,
    type: SurveyType,
    attentionDefault: boolean,
    hasCSAT: boolean,
    hasNPS: boolean,
    hasMessage: boolean,
    questions?: Question[],
    queueId?: string
  ): Promise<SurveyPersonalized> {
    const survey = new SurveyPersonalized();

    survey.commerceId = commerceId;
    survey.type = type;
    if (attentionDefault) {
      survey.attentionDefault = attentionDefault;
    }
    if (hasCSAT) {
      survey.hasCSAT = hasCSAT;
    }
    if (hasNPS) {
      survey.hasNPS = hasNPS;
    }
    if (hasMessage) {
      survey.hasMessage = hasMessage;
    }
    if (questions) {
      survey.questions = questions;
    }
    if (queueId !== undefined) {
      survey.queueId = queueId;
    }
    survey.active = true;
    survey.available = true;
    survey.createdAt = new Date();
    const surveyCreated = await this.surveyPersonalizedRepository.create(survey);
    const surveyCreatedEvent = new SurveyPersonalizedCreated(new Date(), surveyCreated);
    publish(surveyCreatedEvent);

    return surveyCreated;
  }

  public async update(user, survey: SurveyPersonalized): Promise<SurveyPersonalized> {
    const surveyPersonalizedUpdated = await this.surveyPersonalizedRepository.update(survey);
    const surveyPersonalizedUpdatedEvent = new SurveyPersonalizedUpdated(
      new Date(),
      surveyPersonalizedUpdated,
      { user }
    );
    publish(surveyPersonalizedUpdatedEvent);
    return surveyPersonalizedUpdated;
  }

  public async updateSurveyPersonalized(
    user: string,
    type: SurveyType,
    id: string,
    active: boolean,
    available: boolean,
    attentionDefault: boolean,
    hasCSAT: boolean,
    hasNPS: boolean,
    hasMessage: boolean,
    questions?: Question[],
    queueId?: string
  ): Promise<SurveyPersonalized> {
    try {
      const survey = await this.surveyPersonalizedRepository.findById(id);
      if (type) {
        survey.type = type;
      }
      if (active !== undefined) {
        survey.active = active;
      }
      if (available !== undefined) {
        survey.available = available;
      }
      if (attentionDefault !== undefined) {
        survey.attentionDefault = attentionDefault;
      }
      if (hasCSAT !== undefined) {
        survey.hasCSAT = hasCSAT;
      }
      if (hasNPS !== undefined) {
        survey.hasNPS = hasNPS;
      }
      if (hasMessage !== undefined) {
        survey.hasMessage = hasMessage;
      }
      if (questions !== undefined) {
        survey.questions = questions;
      }
      if (queueId !== undefined) {
        survey.queueId = queueId;
      }
      const surveyPersonalizedUpdated = await this.update(user, survey);
      return surveyPersonalizedUpdated;
    } catch (error) {
      throw `Hubo un problema al modificar la encuesta: ${error.message}`;
    }
  }
}
