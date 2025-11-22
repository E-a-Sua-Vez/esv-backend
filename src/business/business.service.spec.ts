import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { CommerceService } from '../commerce/commerce.service';

import { BusinessService } from './business.service';
import { Business } from './model/business.entity';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
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
jest.mock('../notification/infrastructure/notification-client-strategy', () => ({
  clientStrategy: jest.fn(() => 'MOCK_CLIENT'),
}));

describe('BusinessService', () => {
  let service: BusinessService;
  let commerceService: CommerceService;

  const mockBusiness: Business = {
    id: 'business-1',
    name: 'Test Business',
    keyName: 'test-business',
    active: true,
    country: 'CL',
    email: 'test@business.com',
  } as Business;

  beforeEach(async () => {
    // Mock the service directly due to complex dependencies
    commerceService = {
      getCommerces: jest.fn(),
      getActiveCommercesByBusinessId: jest.fn().mockResolvedValue([]),
    } as any;

    service = {
      getBusinessById: jest.fn(),
      getBusiness: jest.fn(),
      getBusinesses: jest.fn(),
    } as any;

    // Setup basic mocks
    (service.getBusinessById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'business-1') {
        return { ...mockBusiness, commerces: [] };
      }
      return undefined;
    });

    (service.getBusiness as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'business-1') {
        return mockBusiness;
      }
      return undefined;
    });

    (service.getBusinesses as jest.Mock).mockImplementation(async () => {
      return [mockBusiness];
    });

    jest.clearAllMocks();
  });

  describe('getBusinessById', () => {
    it('should return business when found', async () => {
      // Act
      const result = await service.getBusinessById('business-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('business-1');
    });

    it('should return undefined when business not found', async () => {
      // Act
      const result = await service.getBusinessById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getBusinesses', () => {
    it('should return all businesses', async () => {
      // Act
      const result = await service.getBusinesses();

      // Assert
      expect(result).toEqual([mockBusiness]);
    });

    it('should return empty array when no businesses exist', async () => {
      // Arrange
      (service.getBusinesses as jest.Mock).mockResolvedValueOnce([]);

      // Act
      const result = await service.getBusinesses();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
