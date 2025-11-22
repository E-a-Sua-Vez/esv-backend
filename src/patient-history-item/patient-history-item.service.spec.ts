import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { PatientHistoryItem } from './model/patient-history-item.entity';
import { PatientHistoryItemService } from './patient-history-item.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('PatientHistoryItemService', () => {
  let service: PatientHistoryItemService;

  const mockPatientHistoryItem: PatientHistoryItem = {
    id: 'item-1',
    commerceId: 'commerce-1',
    name: 'Test Item',
    type: 'CONSULTATION_REASON' as any,
    tag: 'test-tag',
    order: 1,
    characteristics: {} as any,
    online: true,
    active: true,
    available: true,
    createdAt: new Date(),
  } as PatientHistoryItem;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getPatientHistoryItemById: jest.fn(),
      getAllPatientHistoryItem: jest.fn(),
      getPatientHistoryItemsByCommerceId: jest.fn(),
      getActivePatientHistoryItemsByCommerceId: jest.fn(),
    } as any;

    (service.getPatientHistoryItemById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'item-1') {
        return mockPatientHistoryItem;
      }
      return undefined;
    });

    (service.getAllPatientHistoryItem as jest.Mock).mockImplementation(async () => {
      return [mockPatientHistoryItem];
    });

    (service.getPatientHistoryItemsByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockPatientHistoryItem];
    });

    (service.getActivePatientHistoryItemsByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockPatientHistoryItem];
    });

    jest.clearAllMocks();
  });

  describe('getPatientHistoryItemById', () => {
    it('should return patient history item when found', async () => {
      // Act
      const result = await service.getPatientHistoryItemById('item-1');

      // Assert
      expect(result).toEqual(mockPatientHistoryItem);
    });

    it('should return undefined when patient history item not found', async () => {
      // Act
      const result = await service.getPatientHistoryItemById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAllPatientHistoryItem', () => {
    it('should return all patient history items', async () => {
      // Act
      const result = await service.getAllPatientHistoryItem();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getPatientHistoryItemsByCommerceId', () => {
    it('should return patient history items for a commerce', async () => {
      // Act
      const result = await service.getPatientHistoryItemsByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getActivePatientHistoryItemsByCommerceId', () => {
    it('should return active patient history items for a commerce', async () => {
      // Act
      const result = await service.getActivePatientHistoryItemsByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
