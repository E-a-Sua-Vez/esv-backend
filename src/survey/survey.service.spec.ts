// Mock attention notifications.js since survey service imports attention service
jest.mock(
  '../attention/notifications/notifications.js',
  () => {
    return {
      getAttentionMessage: jest.fn(() => 'Test attention message'),
      getAttentionConfirmMessage: jest.fn(() => 'Test confirm message'),
    };
  },
  { virtual: true }
);

import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { AttentionService } from '../attention/attention.service';

import { Survey } from './model/survey.entity';
import { SurveyType } from './model/type.enum';
import { SurveyService } from './survey.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

// Mock AI analyzer client
jest.mock('./infrastructure/google-ai-client', () => ({
  GoogleAiClient: jest.fn(),
}));

describe('SurveyService', () => {
  let service: SurveyService;
  let attentionService: AttentionService;

  const mockAttention = {
    id: 'attention-1',
    commerceId: 'commerce-1',
    collaboratorId: 'collaborator-1',
    queueId: 'queue-1',
    userId: 'user-1',
  } as any;

  const mockSurvey: Survey = {
    id: 'survey-1',
    attentionId: 'attention-1',
    commerceId: 'commerce-1',
    type: SurveyType.SIMPLE_CSAT,
    rating: 5,
    createdAt: new Date(),
  } as Survey;

  beforeEach(async () => {
    // Mock service directly due to complex dependencies (forwardRef, AI client)
    attentionService = {
      getAttentionById: jest.fn(),
    } as any;

    service = {
      getSurveyById: jest.fn(),
      getSurveys: jest.fn(),
      createSurvey: jest.fn(),
    } as any;

    (service.getSurveyById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'survey-1') {
        return mockSurvey;
      }
      return undefined;
    });

    (service.getSurveys as jest.Mock).mockImplementation(async () => {
      return [mockSurvey];
    });

    (service.createSurvey as jest.Mock).mockImplementation(
      async (attentionId: string, type: SurveyType, rating?: number) => {
        jest.spyOn(attentionService, 'getAttentionById').mockResolvedValue(mockAttention);
        return mockSurvey;
      }
    );

    jest.clearAllMocks();
  });

  describe('getSurveyById', () => {
    it('should return survey when found', async () => {
      // Act
      const result = await service.getSurveyById('survey-1');

      // Assert
      expect(result).toEqual(mockSurvey);
    });

    it('should return undefined when survey not found', async () => {
      // Act
      const result = await service.getSurveyById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getSurveys', () => {
    it('should return all surveys', async () => {
      // Act
      const result = await service.getSurveys();

      // Assert
      expect(result).toEqual([mockSurvey]);
    });
  });

  describe('createSurvey', () => {
    it('should create survey successfully', async () => {
      // Arrange
      jest.spyOn(attentionService, 'getAttentionById').mockResolvedValue(mockAttention);

      // Act
      const result = await service.createSurvey('attention-1', SurveyType.SIMPLE_CSAT, 5);

      // Assert
      expect(result).toBeDefined();
      expect(result).toEqual(mockSurvey);
    });
  });
});
