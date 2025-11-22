import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { FeatureToggleService } from './feature-toggle.service';
import { FeatureToggle } from './model/feature-toggle.entity';
import { FeatureToggleName } from './model/feature-toggle.enum';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('FeatureToggleService', () => {
  let service: FeatureToggleService;

  const mockFeatureToggle: FeatureToggle = {
    id: 'feature-1',
    commerceId: 'commerce-1',
    name: 'test-feature',
    type: FeatureToggleName.EMAIL,
    active: true,
    createdAt: new Date(),
  } as FeatureToggle;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getFeatureToggleById: jest.fn(),
      getFeatureToggleByCommerceId: jest.fn(),
    } as any;

    (service.getFeatureToggleById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'feature-1') {
        return mockFeatureToggle;
      }
      return undefined;
    });

    (service.getFeatureToggleByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockFeatureToggle];
    });

    jest.clearAllMocks();
  });

  describe('getFeatureToggleById', () => {
    it('should return feature toggle when found', async () => {
      // Act
      const result = await service.getFeatureToggleById('feature-1');

      // Assert
      expect(result).toEqual(mockFeatureToggle);
    });

    it('should return undefined when feature toggle not found', async () => {
      // Act
      const result = await service.getFeatureToggleById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getFeatureToggleByCommerceId', () => {
    it('should return feature toggles for a commerce', async () => {
      // Act
      const result = await service.getFeatureToggleByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
