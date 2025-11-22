import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { ServiceService } from '../service/service.service';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import { QueueType } from './model/queue-type.enum';
import { Queue } from './model/queue.entity';
import { QueueService } from './queue.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
};

// Mock FireORM Collection decorator
jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}), // Mock decorator
}));

describe('QueueService', () => {
  let service: QueueService;
  let serviceService: ServiceService;

  const mockQueue: Queue = {
    id: 'queue-1',
    name: 'Test Queue',
    commerceId: 'commerce-1',
    limit: 10,
    type: QueueType.STANDARD,
    active: true,
    available: true,
    online: true,
    serviceInfo: {
      blockLimit: 1,
      blocks: [{ number: 1, hourFrom: '09:00', hourTo: '10:00' }],
    },
  } as Queue;

  beforeEach(async () => {
    const mockServiceService = {
      getServicesById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: QueueService,
          useFactory: (logger: GcpLoggerService) => {
            return new QueueService(mockRepository as any, mockServiceService as any, logger);
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
          provide: ServiceService,
          useValue: mockServiceService,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    serviceService = module.get<ServiceService>(ServiceService);

    jest.clearAllMocks();
  });

  describe('getQueueById', () => {
    it('should return queue when found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockQueue);

      // Act
      const result = await service.getQueueById('queue-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('queue-1');
      expect(mockRepository.findById).toHaveBeenCalledWith('queue-1');
    });

    it('should throw error when queue not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.getQueueById('non-existent')).rejects.toThrow(HttpException);
      await expect(service.getQueueById('non-existent')).rejects.toThrow('No se encontro la cola');
    });
  });

  describe('getQueues', () => {
    it('should return all queues', async () => {
      // Arrange
      const queues = [mockQueue];
      mockRepository.find.mockResolvedValue(queues);

      // Act
      const result = await service.getQueues();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('should return empty array when no queues exist', async () => {
      // Arrange
      mockRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getQueues();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getQueueByCommerce', () => {
    it('should return queues for a commerce', async () => {
      // Arrange
      const queues = [mockQueue];
      mockRepository.whereEqualTo.mockReturnThis();
      mockRepository.orderByAscending.mockReturnThis();
      mockRepository.find.mockResolvedValue(queues);

      // Act
      const result = await service.getQueueByCommerce('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });

    it('should return empty array when no queues found', async () => {
      // Arrange
      mockRepository.whereEqualTo.mockReturnThis();
      mockRepository.orderByAscending.mockReturnThis();
      mockRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getQueueByCommerce('commerce-1');

      // Assert
      expect(result).toEqual([]);
    });
  });
});
