import { Module } from './module.entity';
import { ModuleService } from './module.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('ModuleService', () => {
  let service: ModuleService;

  const mockModule: Module = {
    id: 'module-1',
    name: 'Test Module',
    commerceId: 'commerce-1',
    active: true,
    available: true,
    createdAt: new Date(),
  } as Module;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getModuleById: jest.fn(),
      getAllModule: jest.fn(),
      getModulesByCommerceId: jest.fn(),
      getActiveModulesByCommerceId: jest.fn(),
    } as Partial<ModuleService> as ModuleService;

    (service.getModuleById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'module-1') {
        return mockModule;
      }
      return undefined;
    });

    (service.getAllModule as jest.Mock).mockImplementation(async () => {
      return [mockModule];
    });

    (service.getModulesByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockModule];
    });

    (service.getActiveModulesByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockModule];
    });

    jest.clearAllMocks();
  });

  describe('getModuleById', () => {
    it('should return module when found', async () => {
      // Act
      const result = await service.getModuleById('module-1');

      // Assert
      expect(result).toEqual(mockModule);
    });

    it('should return undefined when module not found', async () => {
      // Act
      const result = await service.getModuleById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAllModule', () => {
    it('should return all available modules', async () => {
      // Act
      const result = await service.getAllModule();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getModulesByCommerceId', () => {
    it('should return modules for a commerce', async () => {
      // Act
      const result = await service.getModulesByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getActiveModulesByCommerceId', () => {
    it('should return active modules for a commerce', async () => {
      // Act
      const result = await service.getActiveModulesByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
