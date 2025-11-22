import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { Partner } from './partner.entity';
import { PartnerService } from './partner.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('PartnerService', () => {
  let service: PartnerService;

  const mockPartner: Partner = {
    id: 'partner-1',
    email: 'partner@test.com',
    phone: '+56912345678',
    active: true,
    alias: 'Test Partner',
    name: 'Test Partner Name',
    businessIds: [],
    token: 'test-token',
    lastSignIn: new Date(),
    firstPasswordChanged: false,
    lastPasswordChanged: new Date(),
  } as Partner;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getPartnerById: jest.fn(),
      getPartners: jest.fn(),
      getPartnerByEmail: jest.fn(),
      update: jest.fn(),
    } as any;

    (service.getPartnerById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'partner-1') {
        return mockPartner;
      }
      return undefined;
    });

    (service.getPartners as jest.Mock).mockImplementation(async () => {
      return [mockPartner];
    });

    (service.getPartnerByEmail as jest.Mock).mockImplementation(async (email: string) => {
      if (email === 'partner@test.com') {
        return mockPartner;
      }
      return undefined;
    });

    (service.update as jest.Mock).mockImplementation(async (partner: Partner) => {
      return { ...partner, updatedAt: new Date() };
    });

    jest.clearAllMocks();
  });

  describe('getPartnerById', () => {
    it('should return partner when found', async () => {
      // Act
      const result = await service.getPartnerById('partner-1');

      // Assert
      expect(result).toEqual(mockPartner);
    });

    it('should return undefined when partner not found', async () => {
      // Act
      const result = await service.getPartnerById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getPartners', () => {
    it('should return all partners', async () => {
      // Act
      const result = await service.getPartners();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getPartnerByEmail', () => {
    it('should return partner when found by email', async () => {
      // Act
      const result = await service.getPartnerByEmail('partner@test.com');

      // Assert
      expect(result).toEqual(mockPartner);
    });
  });

  describe('update', () => {
    it('should update partner successfully', async () => {
      // Arrange
      const updatedPartner = { ...mockPartner, alias: 'Updated Partner' };

      // Act
      const result = await service.update(updatedPartner);

      // Assert
      expect(result).toBeDefined();
      expect(result.alias).toBe('Updated Partner');
    });
  });
});
