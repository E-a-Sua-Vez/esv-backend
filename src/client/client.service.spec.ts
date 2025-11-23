import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { ClientContactService } from '../client-contact/client-contact.service';
import { CommerceService } from '../commerce/commerce.service';
import { Commerce } from '../commerce/model/commerce.entity';

import { ClientService } from './client.service';
import { Client } from './model/client.entity';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
  find: jest.fn(),
};

describe('ClientService', () => {
  let service: ClientService;
  let clientContactService: ClientContactService;
  let commerceService: CommerceService;

  const mockClient: Client = {
    id: 'client-1',
    name: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+56912345678',
    idNumber: '12345678-9',
    commerceId: 'commerce-1',
    businessId: 'business-1',
  } as Client;

  const mockCommerce: Commerce = {
    id: 'commerce-1',
    name: 'Test Commerce',
    features: [],
  } as Commerce;

  beforeEach(async () => {
    const mockClientContactService = {
      createClientContact: jest.fn(),
      getClientContactsByClientId: jest.fn(),
    };
    const mockCommerceService = {
      getCommerceById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ClientService,
          useFactory: () => {
            return new ClientService(
              mockRepository as any,
              mockClientContactService as any,
              mockCommerceService as any
            );
          },
        },
        {
          provide: ClientContactService,
          useValue: mockClientContactService,
        },
        {
          provide: CommerceService,
          useValue: mockCommerceService,
        },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    clientContactService = module.get<ClientContactService>(ClientContactService);
    commerceService = module.get<CommerceService>(CommerceService);

    // Set repository mock
    (service as any).clientRepository = mockRepository;

    jest.clearAllMocks();
  });

  describe('getClientById', () => {
    it('should return client when found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockClient);

      // Act
      const result = await service.getClientById('client-1');

      // Assert
      expect(result).toEqual(mockClient);
      expect(mockRepository.findById).toHaveBeenCalledWith('client-1');
    });

    it('should return undefined when client not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);

      // Act
      const result = await service.getClientById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('searchClient', () => {
    it('should return client search result when feature is active and client exists', async () => {
      // Arrange
      const commerceWithFeature = {
        ...mockCommerce,
        id: 'commerce-1',
        features: [
          {
            type: 'USER',
            name: 'attention-user-search',
            active: true,
          },
        ],
      };
      jest.spyOn(commerceService, 'getCommerceById').mockResolvedValue(commerceWithFeature as any);
      mockRepository.whereEqualTo.mockReturnThis();
      mockRepository.findOne.mockResolvedValue(mockClient);

      // Act
      const result = await service.searchClient('commerce-1', '12345678-9');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('client-1');
      expect(result.idNumber).toBe('12345678-9');
      expect(commerceService.getCommerceById).toHaveBeenCalledWith('commerce-1');
    });

    it('should return empty response when feature is not active', async () => {
      // Arrange
      const commerceWithoutFeature = {
        ...mockCommerce,
        id: 'commerce-1',
        features: [], // Empty features array - service returns empty response, doesn't throw
      };
      jest
        .spyOn(commerceService, 'getCommerceById')
        .mockResolvedValue(commerceWithoutFeature as any);

      // Act
      const result = await service.searchClient('commerce-1', '12345678-9');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeUndefined();
    });

    it('should throw error when feature exists but is not active', async () => {
      // Arrange
      const commerceWithInactiveFeature = {
        ...mockCommerce,
        id: 'commerce-1',
        features: [
          {
            type: 'USER',
            name: 'attention-user-search',
            active: false, // Feature exists but is inactive
          },
        ],
      };
      jest
        .spyOn(commerceService, 'getCommerceById')
        .mockResolvedValue(commerceWithInactiveFeature as any);

      // Act & Assert
      await expect(service.searchClient('commerce-1', '12345678-9')).rejects.toThrow(HttpException);
      await expect(service.searchClient('commerce-1', '12345678-9')).rejects.toThrow(
        'No puede realizar esta acción'
      );
    });

    it('should throw error when commerce not found', async () => {
      // Arrange
      jest.spyOn(commerceService, 'getCommerceById').mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.searchClient('non-existent', '12345678-9')).rejects.toThrow(
        HttpException
      );
    });
  });
});
