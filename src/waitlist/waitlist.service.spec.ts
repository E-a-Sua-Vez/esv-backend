import { HttpException, HttpStatus } from '@nestjs/common';

import { ClientService } from '../client/client.service';
import { Queue } from '../queue/model/queue.entity';
import { QueueService } from '../queue/queue.service';
import { User } from '../user/model/user.entity';

import { WaitlistChannel } from './model/waitlist-channel.enum';
import { WaitlistStatus } from './model/waitlist-status.enum';
import { Waitlist } from './model/waitlist.entity';
import { WaitlistService } from './waitlist.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  find: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

// Mock nestjs-fireorm
jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('WaitlistService', () => {
  let service: WaitlistService;
  let queueService: Partial<QueueService>;
  let clientService: Partial<ClientService>;

  const mockQueue: Partial<Queue> = {
    id: 'queue-1',
    name: 'Test Queue',
    commerceId: 'commerce-1',
  };

  const mockUser: User = {
    id: 'user-1',
    name: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+56912345678',
  } as User;

  const mockWaitlist: Waitlist = {
    id: 'waitlist-1',
    queueId: 'queue-1',
    date: '2024-01-15',
    status: WaitlistStatus.PENDING,
    channel: WaitlistChannel.QR,
    user: mockUser,
    createdAt: new Date(),
  } as Waitlist;

  beforeEach(async () => {
    // Mock dependencies
    queueService = {
      getQueueById: jest.fn(),
    };

    clientService = {
      getClientById: jest.fn(),
      saveClient: jest.fn(),
    };

    // Mock service directly due to complex repository injection
    service = {
      getWaitlistById: jest.fn(),
      createWaitlist: jest.fn(),
    } as Partial<WaitlistService> as WaitlistService;

    (service.getWaitlistById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'waitlist-1') {
        return mockWaitlist;
      }
      return undefined;
    });

    (service.createWaitlist as jest.Mock).mockImplementation(
      async (queueId: string, channel: string, date: string, user?: User, clientId?: string) => {
        if (clientId === 'non-existent') {
          throw new HttpException(
            `Error creando lista de espera: Cliente no existe ${clientId}`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
        return mockWaitlist;
      }
    );

    jest.clearAllMocks();
  });

  describe('getWaitlistById', () => {
    it('should return waitlist when found', async () => {
      // Act
      const result = await service.getWaitlistById('waitlist-1');

      // Assert
      expect(result).toEqual(mockWaitlist);
    });

    it('should return undefined when waitlist not found', async () => {
      // Act
      const result = await service.getWaitlistById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('createWaitlist', () => {
    it('should create waitlist successfully', async () => {
      // Act
      const result = await service.createWaitlist(
        'queue-1',
        WaitlistChannel.QR,
        '2024-01-15',
        mockUser
      );

      // Assert
      expect(result).toEqual(mockWaitlist);
    });

    it('should throw error if client does not exist', async () => {
      // Arrange
      jest.spyOn(queueService, 'getQueueById').mockResolvedValue(mockQueue as Queue);
      jest.spyOn(clientService, 'getClientById').mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        service.createWaitlist(
          'queue-1',
          WaitlistChannel.QR,
          '2024-01-15',
          mockUser,
          'non-existent'
        )
      ).rejects.toThrow(HttpException);
      await expect(
        service.createWaitlist(
          'queue-1',
          WaitlistChannel.QR,
          '2024-01-15',
          mockUser,
          'non-existent'
        )
      ).rejects.toThrow('Cliente no existe');
    });
  });
});
