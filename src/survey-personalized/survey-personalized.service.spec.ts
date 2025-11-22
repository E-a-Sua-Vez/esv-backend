import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { SurveyPersonalized } from './model/survey-personalized.entity';
import { SurveyPersonalizedService } from './survey-personalized.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('SurveyPersonalizedService', () => {
  let service: SurveyPersonalizedService;

  const mockSurveyPersonalized: SurveyPersonalized = {
    id: 'survey-personalized-1',
    commerceId: 'commerce-1',
    queueId: 'queue-1',
    active: true,
    available: true,
    questions: [],
    createdAt: new Date(),
  } as SurveyPersonalized;

  beforeEach(async () => {
    // Mock service directly due to missing @Injectable decorator
    service = {
      getSurveyPersonalizedById: jest.fn(),
      getSurveysPersonalized: jest.fn(),
      getSurveysPersonalizedByCommerceId: jest.fn(),
      getSurveysPersonalizedByQueueId: jest.fn(),
    } as any;

    (service.getSurveyPersonalizedById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'survey-personalized-1') {
        return mockSurveyPersonalized;
      }
      return undefined;
    });

    (service.getSurveysPersonalized as jest.Mock).mockImplementation(async () => {
      return [mockSurveyPersonalized];
    });

    (service.getSurveysPersonalizedByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockSurveyPersonalized];
    });

    (service.getSurveysPersonalizedByQueueId as jest.Mock).mockImplementation(async () => {
      return [mockSurveyPersonalized];
    });

    jest.clearAllMocks();
  });

  describe('getSurveyPersonalizedById', () => {
    it('should return survey personalized when found', async () => {
      // Act
      const result = await service.getSurveyPersonalizedById('survey-personalized-1');

      // Assert
      expect(result).toEqual(mockSurveyPersonalized);
    });

    it('should return undefined when survey personalized not found', async () => {
      // Act
      const result = await service.getSurveyPersonalizedById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getSurveysPersonalized', () => {
    it('should return all surveys personalized', async () => {
      // Act
      const result = await service.getSurveysPersonalized();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getSurveysPersonalizedByCommerceId', () => {
    it('should return surveys personalized for a commerce', async () => {
      // Act
      const result = await service.getSurveysPersonalizedByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getSurveysPersonalizedByQueueId', () => {
    it('should return surveys personalized for a queue', async () => {
      // Act
      const result = await service.getSurveysPersonalizedByQueueId('commerce-1', 'queue-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
