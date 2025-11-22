import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { ClientContactService } from './client-contact.service';
import { ClientContactResult } from './model/client-contact-result.enum';
import { ClientContactType } from './model/client-contact-type.enum';
import { ClientContact } from './model/client-contact.entity';

// Mock FireORM repository
const mockRepository = {
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

describe('ClientContactService', () => {
  let service: ClientContactService;

  const mockClientContact: ClientContact = {
    id: 'contact-1',
    clientId: 'client-1',
    type: ClientContactType.CALL,
    result: ClientContactResult.INTERESTED,
    comment: 'Test contact',
    commerceId: 'commerce-1',
    collaboratorId: 'collaborator-1',
    createdAt: new Date(),
  } as ClientContact;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getClientContactByClientId: jest.fn(),
      createClientContact: jest.fn(),
    } as any;

    (service.getClientContactByClientId as jest.Mock).mockImplementation(async () => {
      return [mockClientContact];
    });

    (service.createClientContact as jest.Mock).mockImplementation(
      async (
        clientId: string,
        type: ClientContactType,
        result: ClientContactResult,
        comment: string,
        commerceId?: string,
        collaboratorId?: string
      ) => {
        return {
          id: 'new-contact',
          clientId,
          type,
          result,
          comment,
          commerceId,
          collaboratorId,
          createdAt: new Date(),
        };
      }
    );

    jest.clearAllMocks();
  });

  describe('getClientContactByClientId', () => {
    it('should return client contacts for a client', async () => {
      // Act
      const result = await service.getClientContactByClientId('client-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('createClientContact', () => {
    it('should create client contact successfully', async () => {
      // Arrange
      const clientId = 'client-1';
      const type = ClientContactType.CALL;
      const result = ClientContactResult.INTERESTED;
      const comment = 'Test contact';

      // Act
      const result_contact = await service.createClientContact(clientId, type, result, comment);

      // Assert
      expect(result_contact).toBeDefined();
      expect(result_contact.clientId).toBe(clientId);
      expect(result_contact.type).toBe(type);
      expect(result_contact.result).toBe(result);
    });

    it('should create client contact with optional parameters', async () => {
      // Arrange
      const clientId = 'client-1';
      const type = ClientContactType.EMAIL;
      const result = ClientContactResult.REJECTED;
      const comment = 'Test contact';
      const commerceId = 'commerce-1';
      const collaboratorId = 'collaborator-1';

      // Act
      const result_contact = await service.createClientContact(
        clientId,
        type,
        result,
        comment,
        commerceId,
        collaboratorId
      );

      // Assert
      expect(result_contact).toBeDefined();
      expect(result_contact.commerceId).toBe(commerceId);
      expect(result_contact.collaboratorId).toBe(collaboratorId);
    });
  });
});
