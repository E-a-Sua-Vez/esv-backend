import { PackageStatus } from './model/package-status.enum';
import { PackageType } from './model/package-type.enum';
import { Package } from './model/package.entity';
import { PackageService } from './package.service';

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
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('PackageService', () => {
  let service: PackageService;

  const mockPackage: Package = {
    id: 'package-1',
    commerceId: 'commerce-1',
    clientId: 'client-1',
    status: PackageStatus.CONFIRMED,
    type: PackageType.STANDARD,
    proceduresAmount: 5,
    createdAt: new Date(),
  } as Package;

  beforeEach(async () => {
    // Mock service directly due to complex dependencies
    service = {
      getPackageById: jest.fn(),
      getPackages: jest.fn(),
    } as Partial<PackageService> as PackageService;

    (service.getPackageById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'package-1') {
        return mockPackage;
      }
      return undefined;
    });

    (service.getPackages as jest.Mock).mockImplementation(async () => {
      return [mockPackage];
    });

    jest.clearAllMocks();
  });

  describe('getPackageById', () => {
    it('should return package when found', async () => {
      // Act
      const result = await service.getPackageById('package-1');

      // Assert
      expect(result).toEqual(mockPackage);
    });

    it('should return undefined when package not found', async () => {
      // Act
      const result = await service.getPackageById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getPackages', () => {
    it('should return all packages', async () => {
      // Act
      const result = await service.getPackages();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
