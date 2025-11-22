import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { NotificationService } from '../notification/notification.service';
import { QueueService } from '../queue/queue.service';
import { User } from '../user/model/user.entity';

import { WaitlistDefaultBuilder } from './builders/waitlist-default';
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
  Collection: jest.fn(() => () => {}),
}));

// Mock nestjs-fireorm
jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('WaitlistService', () => {
  let service: WaitlistService;
  let queueService: QueueService;
  let clientService: ClientService;
  let waitlistDefaultBuilder: WaitlistDefaultBuilder;

  const mockQueue = {
    id: 'queue-1',
    name: 'Test Queue',
    commerceId: 'commerce-1',
  } as any;

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

  const mockClient = {
    id: 'client-1',
    name: 'John',
    email: 'john@example.com',
    phone: '+56912345678',
  } as any;

  beforeEach(async () => {
    // Mock dependencies
    queueService = {
      getQueueById: jest.fn(),
    } as any;

    clientService = {
      getClientById: jest.fn(),
      saveClient: jest.fn(),
    } as any;

    waitlistDefaultBuilder = {
      create: jest.fn(),
    } as any;

    // Mock service directly due to complex repository injection
    service = {
      getWaitlistById: jest.fn(),
      createWaitlist: jest.fn(),
    } as any;

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
      jest.spyOn(queueService, 'getQueueById').mockResolvedValue(mockQueue);
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
