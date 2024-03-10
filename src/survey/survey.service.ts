import { Survey } from './model/survey.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { AttentionService } from 'src/attention/attention.service';
import { publish } from 'ett-events-lib';
import SurveyCreated from './events/SurveyCreated';
import { AttentionStatus } from '../attention/model/attention-status.enum';
import { SurveyType } from './model/type.enum';
import { GoogleAiClient } from './infrastructure/google-ai-client';
import { forwardRef, Inject } from '@nestjs/common';
import { GoogleAiAnalyzerMethods } from './infrastructure/google-ai-analyzer-methods.enum';
import { GoogleAiAnalyzerTypes } from './infrastructure/google-ai-analyzer-types.enum';
import { AiAnalyzerClient } from './infrastructure/ai-analyzer';
import { Question } from 'src/survey-personalized/model/survey-personalized.entity';
import { QuestionType } from '../survey-personalized/model/question-type.enum';
import SurveyUpdated from './events/SurveyUpdated';

export class SurveyService {
  constructor(
    @InjectRepository(Survey)
    private surveyRepository = getRepository(Survey),
    private attentionService: AttentionService,
    @Inject(forwardRef(() => GoogleAiClient))
    private aiAnalyzerClient: AiAnalyzerClient
  ) {}

  public async getSurveyById(id: string): Promise<Survey> {
    return await this.surveyRepository.findById(id);
  }

  public async getSurveys(): Promise<Survey[]> {
    return await this.surveyRepository.find();
  }

  public async createSurvey(attentionId: string, type: SurveyType, rating?: number, nps?: number, message?: string, personalizedId?: string, questions?: Question[], answers?: object[]): Promise<Survey> {
    let survey = new Survey();

    const attention = await this.attentionService.getAttentionById(attentionId);

    survey.attentionId = attentionId;
    survey.commerceId = attention.commerceId;
    survey.collaboratorId = attention.collaboratorId;
    survey.type = type;
    survey.queueId = attention.queueId;
    survey.userId = attention.userId || '';
    if (rating) {
      survey.rating = rating;
    }
    if (nps) {
      survey.nps = nps;
    }
    let analyzeCommentScore;
    let analyzeCommentEntities;
    if (message) {
      survey.message = message;
      try {
        analyzeCommentScore = await this.aiAnalyzerClient.analyzeCommentScore(message, GoogleAiAnalyzerMethods.ANALYZE_SENTIMENT, GoogleAiAnalyzerTypes.PLAIN_TEXT);
        survey.messageScore = analyzeCommentScore.score;
      } catch (error) {
        survey.messageScore = 0;
      }
      try {
        analyzeCommentEntities = await this.aiAnalyzerClient.analyzeCommentEntities(message, GoogleAiAnalyzerMethods.ANALYZE_ENTITY_SENTIMENT, GoogleAiAnalyzerTypes.PLAIN_TEXT);
        survey.messageEntities = analyzeCommentEntities.result;
      } catch (error) {
        survey.messageEntities = {};
      }
      if (Object.keys(survey.messageEntities).length === 0) {
        try {
          analyzeCommentEntities = await this.aiAnalyzerClient.analyzeCommentEntities(message, GoogleAiAnalyzerMethods.ANALYZE_ENTITIES, GoogleAiAnalyzerTypes.PLAIN_TEXT);
          survey.messageEntities = analyzeCommentEntities.result;
        } catch (error) {
          survey.messageEntities = {};
        }
      }
    }
    if (personalizedId) {
      survey.personalizedId = personalizedId;
    }
    if (questions) {
      survey.questions = questions;
    }
    if (answers && answers.length > 0) {
      for (let i = 0; i < answers.length; i++) {
        const answer = answers[i];
        if (answer['type'] === QuestionType.OPEN_WRITING && (answer['analize'] !== undefined && answer['analize'] === true)) {
          const message = answer['answer'] || undefined;
          try {
            if (message) {
              const messageScore = await this.aiAnalyzerClient.analyzeCommentScore(message, GoogleAiAnalyzerMethods.ANALYZE_SENTIMENT, GoogleAiAnalyzerTypes.PLAIN_TEXT);
              answer['answer'] = {
                message,
                messageScore
              }
            }
          } catch (error) {
            answer['answer'] = {
              message,
              messageScore: undefined
            }
          }
        }
      }
      survey.answers = answers;
    }
    survey.createdAt = new Date();
    const surveyCreated = await this.surveyRepository.create(survey);
    const surveyCreatedEvent = new SurveyCreated(new Date(), surveyCreated, { analyzeCommentScore, analyzeCommentEntities });
    publish(surveyCreatedEvent);

    attention.surveyId = surveyCreated.id;
    attention.status = AttentionStatus.RATED;
    attention.ratedAt = new Date();
    const diff = attention.ratedAt.getTime() - attention.endAt.getTime();
    attention.rateDuration = diff/(1000*60);

    await this.attentionService.update('', attention);

    return surveyCreated;
  }

  public async update(user: string, survey: Survey): Promise<Survey> {
    const surveyUpdated = await this.surveyRepository.update(survey);
    const surveyUpdatedEvent = new SurveyUpdated(new Date(), surveyUpdated, { user });
    publish(surveyUpdatedEvent);
    return surveyUpdated;
  }

  public async contactSurvey(user: string, id: string): Promise<Survey> {
    let survey = await this.getSurveyById(id);
    if (survey && survey.contacted !== true) {
      survey.contacted = true;
      survey.contactedDate = new Date();
    }
    return await this.update(user, survey);
  }
}
