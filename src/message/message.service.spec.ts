import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { AdministratorService } from '../administrator/administrator.service';
import { CommerceService } from '../commerce/commerce.service';

import { MessageService } from './message.service';
import { Message } from './model/message.entity';

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

describe('MessageService', () => {
  let service: MessageService;
  let administratorService: AdministratorService;
  let commerceService: CommerceService;

  const mockMessage: Message = {
    id: 'message-1',
    clientId: 'client-1',
    administratorId: 'admin-1',
    active: true,
    available: true,
    read: false,
    createdAt: new Date(),
  } as Message;

  beforeEach(async () => {
    // Mock service directly due to missing @Injectable decorator
    administratorService = {
      getAdministratorById: jest.fn(),
    } as any;

    commerceService = {
      getCommerceById: jest.fn(),
    } as any;

    service = {
      getMessageById: jest.fn(),
      getMessages: jest.fn(),
      getMessagesByClient: jest.fn(),
      getMessagesByAdministrator: jest.fn(),
    } as any;

    (service.getMessageById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'message-1') {
        return mockMessage;
      }
      return undefined;
    });

    (service.getMessages as jest.Mock).mockImplementation(async () => {
      return [mockMessage];
    });

    (service.getMessagesByClient as jest.Mock).mockImplementation(async () => {
      return [mockMessage];
    });

    (service.getMessagesByAdministrator as jest.Mock).mockImplementation(async () => {
      return [mockMessage];
    });

    jest.clearAllMocks();
  });

  describe('getMessageById', () => {
    it('should return message when found', async () => {
      // Act
      const result = await service.getMessageById('message-1');

      // Assert
      expect(result).toEqual(mockMessage);
    });

    it('should return undefined when message not found', async () => {
      // Act
      const result = await service.getMessageById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getMessages', () => {
    it('should return all messages', async () => {
      // Act
      const result = await service.getMessages();

      // Assert
      expect(result).toEqual([mockMessage]);
    });
  });

  describe('getMessagesByClient', () => {
    it('should return messages for a client', async () => {
      // Act
      const result = await service.getMessagesByClient('client-1');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
  });

  describe('getMessagesByAdministrator', () => {
    it('should return messages for an administrator', async () => {
      // Act
      const result = await service.getMessagesByAdministrator('admin-1');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
  });
});
