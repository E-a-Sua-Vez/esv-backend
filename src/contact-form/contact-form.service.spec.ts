import { Test, TestingModule } from '@nestjs/testing';

import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import { ContactFormService } from './contact-form.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn(() => mockRepository),
  orderByDescending: jest.fn(() => mockRepository),
  limit: jest.fn(() => mockRepository),
  offset: jest.fn(() => mockRepository),
  findOne: jest.fn(),
};

// Mock GcpLoggerService
const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

interface MockRepository {
  findById: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  whereEqualTo: jest.Mock;
  orderByDescending: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  findOne: jest.Mock;
}

describe('ContactFormService', () => {
  let service: ContactFormService;
  let repository: MockRepository;

  beforeEach(async () => {
    // Mock getRepository
    const fireorm = await import('fireorm');
    jest
      .spyOn(fireorm, 'getRepository')
      .mockReturnValue(mockRepository as unknown as ReturnType<typeof fireorm.getRepository>);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactFormService,
        {
          provide: GcpLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<ContactFormService>(ContactFormService);
    repository = mockRepository;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processContactFormEvent', () => {
    it('should process a contact form event and create a submission', async () => {
      const eventData = {
        data: {
          id: 'event-123',
          type: 'ett.contact.1.event.contact-form.submitted',
          occurredOn: '2024-01-15T10:30:00.000Z',
          attributes: {
            id: 'submission-123',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+5511999999999',
            company: 'Test Company',
            message: 'Test message',
            source: 'contact-form',
            page: 'https://easuavez.com/pricing',
          },
        },
        metadata: {
          origin: 'ETT-PUBLIC-PT',
          userAgent: 'Mozilla/5.0',
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      const expectedSubmission = {
        id: 'submission-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+5511999999999',
        company: 'Test Company',
        message: 'Test message',
        source: 'contact-form',
        page: 'https://easuavez.com/pricing',
        eventId: 'event-123',
        eventOccurredOn: new Date('2024-01-15T10:30:00.000Z'),
        createdAt: new Date(),
        processedAt: new Date(),
        metadata: {
          origin: 'ETT-PUBLIC-PT',
          userAgent: 'Mozilla/5.0',
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      repository.whereEqualTo.mockReturnValue(repository);
      repository.findOne.mockResolvedValue(null);
      repository.create.mockResolvedValue(expectedSubmission);

      const result = await service.processContactFormEvent(eventData);

      expect(result).toEqual(expectedSubmission);
      expect(repository.whereEqualTo).toHaveBeenCalledWith('eventId', 'event-123');
      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
    });

    it('should return existing submission if event already processed (idempotency)', async () => {
      const eventData = {
        data: {
          id: 'event-123',
          attributes: {
            id: 'submission-123',
          },
        },
      };

      const existingSubmission = {
        id: 'submission-123',
        eventId: 'event-123',
      };

      repository.whereEqualTo.mockReturnValue(repository);
      repository.findOne.mockResolvedValue(existingSubmission);

      const result = await service.processContactFormEvent(eventData);

      expect(result).toEqual(existingSubmission);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should handle exit-intent source correctly', async () => {
      const eventData = {
        data: {
          id: 'event-456',
          occurredOn: '2024-01-15T10:30:00.000Z',
          attributes: {
            id: 'submission-456',
            name: 'Exit Intent Visitor',
            email: 'visitor@example.com',
            phone: '',
            company: '',
            message: '',
            source: 'exit-intent',
            page: 'https://easuavez.com/',
          },
        },
        metadata: {},
      };

      repository.whereEqualTo.mockReturnValue(repository);
      repository.findOne.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: 'submission-456',
        source: 'exit-intent',
      });

      const result = await service.processContactFormEvent(eventData);

      expect(result.source).toBe('exit-intent');
    });
  });

  describe('getSubmissions', () => {
    it('should get submissions with pagination', async () => {
      const submissions = [
        { id: '1', email: 'test1@example.com' },
        { id: '2', email: 'test2@example.com' },
      ];

      repository.orderByDescending.mockReturnValue(repository);
      repository.limit.mockReturnValue(repository);
      repository.offset.mockReturnValue(repository);
      repository.find.mockResolvedValue(submissions);

      const result = await service.getSubmissions(10, 0);

      expect(result).toEqual(submissions);
      expect(repository.orderByDescending).toHaveBeenCalledWith('createdAt');
      expect(repository.limit).toHaveBeenCalledWith(10);
      expect(repository.offset).toHaveBeenCalledWith(0);
    });
  });

  describe('getSubmissionById', () => {
    it('should get submission by ID', async () => {
      const submission = { id: 'submission-123', email: 'test@example.com' };
      repository.findById.mockResolvedValue(submission);

      const result = await service.getSubmissionById('submission-123');

      expect(result).toEqual(submission);
      expect(repository.findById).toHaveBeenCalledWith('submission-123');
    });
  });

  describe('getSubmissionsBySource', () => {
    it('should get submissions filtered by source', async () => {
      const submissions = [{ id: '1', source: 'contact-form' }];

      repository.whereEqualTo.mockReturnValue(repository);
      repository.orderByDescending.mockReturnValue(repository);
      repository.limit.mockReturnValue(repository);
      repository.offset.mockReturnValue(repository);
      repository.find.mockResolvedValue(submissions);

      const result = await service.getSubmissionsBySource('contact-form', 10, 0);

      expect(result).toEqual(submissions);
      expect(repository.whereEqualTo).toHaveBeenCalledWith('source', 'contact-form');
    });
  });

  describe('getSubmissionsByEmail', () => {
    it('should get submissions by email', async () => {
      const submissions = [{ id: '1', email: 'test@example.com' }];

      repository.whereEqualTo.mockReturnValue(repository);
      repository.orderByDescending.mockReturnValue(repository);
      repository.find.mockResolvedValue(submissions);

      const result = await service.getSubmissionsByEmail('test@example.com');

      expect(result).toEqual(submissions);
      expect(repository.whereEqualTo).toHaveBeenCalledWith('email', 'test@example.com');
    });
  });

  describe('getTotalCount', () => {
    it('should get total count of submissions', async () => {
      const submissions = [{ id: '1' }, { id: '2' }, { id: '3' }];

      repository.find.mockResolvedValue(submissions);

      const result = await service.getTotalCount();

      expect(result).toBe(3);
    });
  });
});
