import { Test, TestingModule } from '@nestjs/testing';

import { CommerceService } from '../commerce/commerce.service';
import { Queue } from '../queue/model/queue.entity';
import { QueueService } from '../queue/queue.service';

import { BlockService } from './block.service';
import { Block } from './model/block.entity';

describe('BlockService', () => {
  let service: BlockService;
  let commerceService: CommerceService;
  let queueService: QueueService;

  const mockQueue = {
    id: 'queue-1',
    commerceId: 'commerce-1',
    blockTime: 30,
    serviceInfo: {
      sameCommeceHours: false,
      attentionHourFrom: 9,
      attentionHourTo: 18,
      break: false,
      breakHourFrom: 0,
      breakHourTo: 0,
    },
  } as Queue;

  const mockCommerce = {
    id: 'commerce-1',
    serviceInfo: {
      attentionHourFrom: 9,
      attentionHourTo: 18,
      break: false,
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockService,
        {
          provide: CommerceService,
          useValue: {
            getCommerceById: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            getQueueById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlockService>(BlockService);
    commerceService = module.get<CommerceService>(CommerceService);
    queueService = module.get<QueueService>(QueueService);

    jest.clearAllMocks();
  });

  describe('getQueueBlockDetails', () => {
    it('should return blocks for queue with serviceInfo', async () => {
      // Arrange
      jest.spyOn(queueService, 'getQueueById').mockResolvedValue(mockQueue);

      // Act
      const result = await service.getQueueBlockDetails('queue-1');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(queueService.getQueueById).toHaveBeenCalledWith('queue-1');
    });

    it('should use commerce serviceInfo when sameCommeceHours is true', async () => {
      // Arrange
      const queueWithSameHours = {
        ...mockQueue,
        serviceInfo: {
          ...mockQueue.serviceInfo,
          sameCommeceHours: true,
        },
      };
      jest.spyOn(queueService, 'getQueueById').mockResolvedValue(queueWithSameHours);
      jest.spyOn(commerceService, 'getCommerceById').mockResolvedValue(mockCommerce);

      // Act
      const result = await service.getQueueBlockDetails('queue-1');

      // Assert
      expect(result).toBeDefined();
      expect(commerceService.getCommerceById).toHaveBeenCalledWith('commerce-1');
    });

    it('should return empty array when blockTime is not set', async () => {
      // Arrange
      const queueWithoutBlockTime = {
        ...mockQueue,
        blockTime: undefined,
      };
      jest.spyOn(queueService, 'getQueueById').mockResolvedValue(queueWithoutBlockTime);

      // Act
      const result = await service.getQueueBlockDetails('queue-1');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
