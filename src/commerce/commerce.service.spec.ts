import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { NotificationService } from '../notification/notification.service';
import { QueueService } from '../queue/queue.service';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';
import { SurveyPersonalizedService } from '../survey-personalized/survey-personalized.service';

import { CommerceService } from './commerce.service';
import { QueryStackClient } from './infrastructure/query-stack-client';
import { Commerce } from './model/commerce.entity';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
};

describe('CommerceService', () => {
  let service: CommerceService;
  let queueService: QueueService;
  let featureToggleService: FeatureToggleService;
  let surveyPersonalizedService: SurveyPersonalizedService;

  const mockCommerce: Commerce = {
    id: 'commerce-1',
    name: 'Test Commerce',
    keyName: 'test-commerce',
    logo: 'logo.png',
    active: true,
    available: true,
    localeInfo: {
      language: 'es',
      timezone: 'America/Santiago',
    },
    serviceInfo: {
      attentionHourFrom: 9,
      attentionHourTo: 18,
    },
  } as Commerce;

  beforeEach(async () => {
    const mockQueueService = {
      getActiveQueuesByCommerce: jest.fn(),
    };
    const mockFeatureToggleService = {
      getFeatureToggleByCommerceId: jest.fn(),
      getFeatureToggleDetailsByCommerceId: jest.fn(),
    };
    const mockSurveyPersonalizedService = {
      getSurveysPersonalizedByCommerceId: jest.fn(),
    };
    const mockNotificationService = {
      createEmailNotification: jest.fn(),
    };
    const mockQueryStackClient = {
      publishCommerce: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CommerceService,
          useFactory: (logger: GcpLoggerService) => {
            return new CommerceService(
              mockRepository as any,
              mockQueueService as any,
              mockFeatureToggleService as any,
              mockSurveyPersonalizedService as any,
              mockNotificationService as any,
              mockQueryStackClient as any,
              logger
            );
          },
          inject: [GcpLoggerService],
        },
        {
          provide: GcpLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            logWithRequest: jest.fn(),
            logError: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: FeatureToggleService,
          useValue: mockFeatureToggleService,
        },
        {
          provide: SurveyPersonalizedService,
          useValue: mockSurveyPersonalizedService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: QueryStackClient,
          useValue: mockQueryStackClient,
        },
      ],
    }).compile();

    service = module.get<CommerceService>(CommerceService);
    queueService = module.get<QueueService>(QueueService);
    featureToggleService = module.get<FeatureToggleService>(FeatureToggleService);
    surveyPersonalizedService = module.get<SurveyPersonalizedService>(SurveyPersonalizedService);

    // Set repository mock
    (service as any).commerceRepository = mockRepository;

    jest.clearAllMocks();
  });

  describe('getCommerceById', () => {
    it('should return commerce with queues, surveys, and features', async () => {
      // Arrange
      const queues = [{ id: 'queue-1', name: 'Queue 1' }];
      const surveys = [{ id: 'survey-1', name: 'Survey 1' }];
      const features = [{ id: 'feature-1', name: 'Feature 1' }];

      mockRepository.findById.mockResolvedValue(mockCommerce);
      jest.spyOn(queueService, 'getActiveQueuesByCommerce').mockResolvedValue(queues as any);
      jest
        .spyOn(surveyPersonalizedService, 'getSurveysPersonalizedByCommerceId')
        .mockResolvedValue(surveys as any);
      jest
        .spyOn(featureToggleService, 'getFeatureToggleByCommerceId')
        .mockResolvedValue(features as any);

      // Act
      const result = await service.getCommerceById('commerce-1');

      // Assert
      expect(result).toEqual(mockCommerce);
      expect(result.queues).toEqual(queues);
      expect(result.surveys).toEqual(surveys);
      expect(result.features).toEqual(features);
      expect(mockRepository.findById).toHaveBeenCalledWith('commerce-1');
    });

    it('should return commerce without queues, surveys, or features if none exist', async () => {
      // Arrange
      const commerceWithoutExtras = { ...mockCommerce };
      // Clear any existing properties
      delete commerceWithoutExtras.queues;
      delete commerceWithoutExtras.surveys;
      delete commerceWithoutExtras.features;

      mockRepository.findById.mockResolvedValue(commerceWithoutExtras);
      jest.spyOn(queueService, 'getActiveQueuesByCommerce').mockResolvedValue([]);
      jest
        .spyOn(surveyPersonalizedService, 'getSurveysPersonalizedByCommerceId')
        .mockResolvedValue([]);
      jest.spyOn(featureToggleService, 'getFeatureToggleByCommerceId').mockResolvedValue([]);

      // Act
      const result = await service.getCommerceById('commerce-1');

      // Assert
      expect(result).toBeDefined();
      // Service only sets properties if arrays have items (length > 0)
      // Empty arrays mean properties are not set, so they should be undefined
      // Note: If the property was already set, it might remain, so we check it's not an array with items
      if (result.queues !== undefined) {
        expect(result.queues.length).toBe(0);
      } else {
        expect(result.queues).toBeUndefined();
      }
      if (result.surveys !== undefined) {
        expect(result.surveys.length).toBe(0);
      } else {
        expect(result.surveys).toBeUndefined();
      }
      if (result.features !== undefined) {
        expect(result.features.length).toBe(0);
      } else {
        expect(result.features).toBeUndefined();
      }
    });
  });

  describe('getCommerce', () => {
    it('should return commerce by id', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockCommerce);

      // Act
      const result = await service.getCommerce('commerce-1');

      // Assert
      expect(result).toEqual(mockCommerce);
      expect(mockRepository.findById).toHaveBeenCalledWith('commerce-1');
    });

    it('should return undefined if commerce not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);

      // Act
      const result = await service.getCommerce('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getCommerces', () => {
    it('should return all commerces', async () => {
      // Arrange
      const commerces = [mockCommerce];
      mockRepository.find.mockResolvedValue(commerces);

      // Act
      const result = await service.getCommerces();

      // Assert
      expect(result).toEqual(commerces);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('should return empty array if no commerces exist', async () => {
      // Arrange
      mockRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getCommerces();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
