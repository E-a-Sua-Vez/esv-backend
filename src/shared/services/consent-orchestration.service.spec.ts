import { Test, TestingModule } from '@nestjs/testing';
import { ConsentOrchestrationService } from './consent-orchestration.service';
import { getRepository } from 'fireorm';
import { ConsentRequirement, ConsentRequestTiming, ConsentRequestMethod } from '../model/consent-requirement.entity';
import { ConsentRequest } from '../model/consent-request.entity';
import { ConsentType } from '../model/lgpd-consent.entity';

// Mock fireorm
jest.mock('fireorm', () => ({
  getRepository: jest.fn(),
}));

// Mock ett-events-lib
jest.mock('ett-events-lib', () => ({
  publish: jest.fn(),
}));

describe('ConsentOrchestrationService', () => {
  let service: ConsentOrchestrationService;
  let mockRequirementRepository: any;
  let mockRequestRepository: any;

  beforeEach(async () => {
    // Mock repositories
    mockRequirementRepository = {
      whereEqualTo: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockRequestRepository = {
      whereEqualTo: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    (getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === ConsentRequirement) {
        return mockRequirementRepository;
      }
      if (entity === ConsentRequest) {
        return mockRequestRepository;
      }
      return {};
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentOrchestrationService,
        {
          provide: 'LgpdConsentService',
          useValue: {},
        },
        {
          provide: 'ClientService',
          useValue: {},
        },
        {
          provide: 'CommerceService',
          useValue: {},
        },
        {
          provide: 'ConsentValidationService',
          useValue: {
            validateRequirement: jest.fn(),
            validateLgpdCompliance: jest.fn().mockReturnValue({ compliant: true, issues: [], warnings: [] }),
            validateMethodForTiming: jest.fn().mockReturnValue({ valid: true }),
          },
        },
        {
          provide: 'NotificationService',
          useValue: {},
        },
        {
          provide: 'AuditLogService',
          useValue: {},
        },
        {
          provide: 'FeatureToggleService',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ConsentOrchestrationService>(ConsentOrchestrationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRequirementsByCommerce', () => {
    it('should return requirements from cache if available', async () => {
      const commerceId = 'commerce-123';
      const cachedRequirements = [
        { id: 'req-1', commerceId, active: true, available: true },
      ];

      // First call - should fetch from DB
      mockRequirementRepository.find.mockResolvedValue(cachedRequirements);
      const result1 = await service.getRequirementsByCommerce(commerceId);
      expect(result1).toEqual(cachedRequirements);
      expect(mockRequirementRepository.find).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await service.getRequirementsByCommerce(commerceId);
      expect(result2).toEqual(cachedRequirements);
      expect(mockRequirementRepository.find).toHaveBeenCalledTimes(1); // Still 1, cache used
    });

    it('should return empty array on error', async () => {
      const commerceId = 'commerce-123';
      mockRequirementRepository.find.mockRejectedValue(new Error('Database error'));

      const result = await service.getRequirementsByCommerce(commerceId);
      expect(result).toEqual([]);
    });
  });

  describe('createRequirement', () => {
    it('should create a requirement and invalidate cache', async () => {
      const commerceId = 'commerce-123';
      const requirement = {
        consentType: ConsentType.DATA_PROCESSING,
        required: true,
        blockingForAttention: false,
        requestStrategy: {
          timing: ConsentRequestTiming.CHECK_IN,
          methods: [ConsentRequestMethod.WHATSAPP],
          reminderIntervalHours: 24,
          maxReminders: 3,
        },
        templates: {
          formIntroText: 'Test intro',
        },
      };

      const created = {
        id: 'req-1',
        commerceId,
        ...requirement,
        active: true,
        available: true,
        createdAt: new Date(),
        createdBy: 'user-1',
      };

      mockRequirementRepository.create.mockResolvedValue(created);

      const result = await service.createRequirement(commerceId, requirement, 'user-1');
      expect(result).toEqual(created);
      expect(mockRequirementRepository.create).toHaveBeenCalled();

      // Verify cache is invalidated (next call should fetch from DB)
      mockRequirementRepository.find.mockResolvedValue([created]);
      const cached = await service.getRequirementsByCommerce(commerceId);
      expect(mockRequirementRepository.find).toHaveBeenCalled(); // Cache was invalidated
    });
  });
});

