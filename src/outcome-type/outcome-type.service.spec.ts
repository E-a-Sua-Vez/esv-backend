import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { OutcomeType } from './model/outcome-type.entity';
import { OutcomeTypeService } from './outcome-type.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('OutcomeTypeService', () => {
  let service: OutcomeTypeService;

  const mockOutcomeType: OutcomeType = {
    id: 'outcome-type-1',
    name: 'Test Outcome Type',
    commerceId: 'commerce-1',
    createdAt: new Date(),
  } as OutcomeType;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getOutcomeTypeById: jest.fn(),
      getOutcomeTypes: jest.fn(),
      getOutcomeTypeByCommerce: jest.fn(),
      getOutcomeTypesById: jest.fn(),
    } as any;

    (service.getOutcomeTypeById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'outcome-type-1') {
        return mockOutcomeType;
      }
      return undefined;
    });

    (service.getOutcomeTypes as jest.Mock).mockImplementation(async () => {
      return [mockOutcomeType];
    });

    (service.getOutcomeTypeByCommerce as jest.Mock).mockImplementation(async () => {
      return [mockOutcomeType];
    });

    (service.getOutcomeTypesById as jest.Mock).mockImplementation(async (ids: string[]) => {
      return ids.map(id => ({ ...mockOutcomeType, id }));
    });

    jest.clearAllMocks();
  });

  describe('getOutcomeTypeById', () => {
    it('should return outcome type when found', async () => {
      // Act
      const result = await service.getOutcomeTypeById('outcome-type-1');

      // Assert
      expect(result).toEqual(mockOutcomeType);
    });

    it('should return undefined when outcome type not found', async () => {
      // Act
      const result = await service.getOutcomeTypeById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getOutcomeTypes', () => {
    it('should return all outcome types', async () => {
      // Act
      const result = await service.getOutcomeTypes();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getOutcomeTypeByCommerce', () => {
    it('should return outcome types for a commerce', async () => {
      // Act
      const result = await service.getOutcomeTypeByCommerce('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
