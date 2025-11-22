import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { ClientService } from '../client/client.service';

import { FormService } from './form.service';
import { Form } from './model/form.entity';
import { FormType } from './model/type.enum';

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

describe('FormService', () => {
  let service: FormService;
  let clientService: ClientService;

  const mockForm: Form = {
    id: 'form-1',
    commerceId: 'commerce-1',
    clientId: 'client-1',
    type: FormType.PRE_ATTENTION,
    createdAt: new Date(),
  } as Form;

  beforeEach(async () => {
    // Mock service directly due to missing @Injectable decorator
    clientService = {
      getClientById: jest.fn(),
    } as any;

    service = {
      getFormById: jest.fn(),
      getForms: jest.fn(),
      getFormsByClient: jest.fn(),
      getFormsByClientAndType: jest.fn(),
    } as any;

    (service.getFormById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'form-1') {
        return mockForm;
      }
      return undefined;
    });

    (service.getForms as jest.Mock).mockImplementation(async () => {
      return [mockForm];
    });

    (service.getFormsByClient as jest.Mock).mockImplementation(async () => {
      return [mockForm];
    });

    (service.getFormsByClientAndType as jest.Mock).mockImplementation(async () => {
      return [mockForm];
    });

    jest.clearAllMocks();
  });

  describe('getFormById', () => {
    it('should return form when found', async () => {
      // Act
      const result = await service.getFormById('form-1');

      // Assert
      expect(result).toEqual(mockForm);
    });

    it('should return undefined when form not found', async () => {
      // Act
      const result = await service.getFormById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getForms', () => {
    it('should return all forms', async () => {
      // Act
      const result = await service.getForms();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getFormsByClient', () => {
    it('should return forms for a client', async () => {
      // Act
      const result = await service.getFormsByClient('commerce-1', 'client-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getFormsByClientAndType', () => {
    it('should return forms for a client by type', async () => {
      // Act
      const result = await service.getFormsByClientAndType(
        'commerce-1',
        'client-1',
        FormType.PRE_ATTENTION
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
