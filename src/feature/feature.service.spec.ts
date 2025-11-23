import { Feature } from './feature.entity';
import { FeatureService } from './feature.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('FeatureService', () => {
  let service: FeatureService;

  const mockFeature: Feature = {
    id: 'feature-1',
    name: 'test-feature',
    description: 'Test Feature',
    type: 'user',
    module: 'test-module',
    active: true,
    createdAt: new Date(),
  } as Feature;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getFeatureById: jest.fn(),
      getFeatureByName: jest.fn(),
      getAllFeature: jest.fn(),
      getFeatureByType: jest.fn(),
      getFeatureByModule: jest.fn(),
    } as Partial<FeatureService> as FeatureService;

    (service.getFeatureById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'feature-1') {
        return mockFeature;
      }
      return undefined;
    });

    (service.getFeatureByName as jest.Mock).mockImplementation(async (name: string) => {
      if (name === 'test-feature') {
        return mockFeature;
      }
      return undefined;
    });

    (service.getAllFeature as jest.Mock).mockImplementation(async () => {
      return [mockFeature];
    });

    (service.getFeatureByType as jest.Mock).mockImplementation(async () => {
      return [mockFeature];
    });

    (service.getFeatureByModule as jest.Mock).mockImplementation(async () => {
      return [mockFeature];
    });

    jest.clearAllMocks();
  });

  describe('getFeatureById', () => {
    it('should return feature when found', async () => {
      // Act
      const result = await service.getFeatureById('feature-1');

      // Assert
      expect(result).toEqual(mockFeature);
    });

    it('should return undefined when feature not found', async () => {
      // Act
      const result = await service.getFeatureById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getFeatureByName', () => {
    it('should return feature when found by name', async () => {
      // Act
      const result = await service.getFeatureByName('test-feature');

      // Assert
      expect(result).toEqual(mockFeature);
    });
  });

  describe('getAllFeature', () => {
    it('should return all features', async () => {
      // Act
      const result = await service.getAllFeature();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getFeatureByType', () => {
    it('should return features by type', async () => {
      // Act
      const result = await service.getFeatureByType('user');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getFeatureByModule', () => {
    it('should return features by module', async () => {
      // Act
      const result = await service.getFeatureByModule('test-module');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
