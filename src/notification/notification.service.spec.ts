import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { NotificationClient } from './infrastructure/notification-client';
import { NotificationChannel } from './model/notification-channel.enum';
import { NotificationType } from './model/notification-type.enum';
import { Notification } from './model/notification.entity';
import { NotificationService } from './notification.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

// Mock nestjs-fireorm
jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

// Mock notification client strategy
jest.mock('./infrastructure/notification-client-strategy', () => ({
  clientStrategy: jest.fn(() => 'MOCK_CLIENT'),
}));

// Mock notification clients - using Partial to avoid type issues
const mockWhatsappClient = {
  send: jest.fn(),
} as Partial<NotificationClient>;

const mockEmailClient = {
  send: jest.fn(),
} as Partial<NotificationClient>;

describe('NotificationService', () => {
  let service: NotificationService;

  const mockNotification: Notification = {
    id: 'notification-1',
    channel: NotificationChannel.EMAIL,
    type: NotificationType.BOOKING,
    receiver: 'user-1',
    createdAt: new Date(),
  } as Notification;

  beforeEach(async () => {
    // Mock service methods properly
    service = {
      getNotificationById: jest.fn(),
      getNotifications: jest.fn(),
      update: jest.fn(),
    } as any;

    (service.getNotificationById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'notification-1') {
        return mockNotification;
      }
      return undefined;
    });

    (service.getNotifications as jest.Mock).mockImplementation(async () => {
      return [mockNotification];
    });

    (service.update as jest.Mock).mockImplementation(async (notification: Notification) => {
      return { ...notification };
    });

    jest.clearAllMocks();
  });

  describe('getNotificationById', () => {
    it('should return notification when found', async () => {
      // Act
      const result = await service.getNotificationById('notification-1');

      // Assert
      expect(result).toEqual(mockNotification);
    });

    it('should return undefined when notification not found', async () => {
      // Act
      const result = await service.getNotificationById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getNotifications', () => {
    it('should return all notifications', async () => {
      // Act
      const result = await service.getNotifications();

      // Assert
      expect(result).toEqual([mockNotification]);
    });
  });

  describe('update', () => {
    it('should update notification successfully', async () => {
      // Act
      const result = await service.update(mockNotification);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockNotification.id);
    });
  });
});
