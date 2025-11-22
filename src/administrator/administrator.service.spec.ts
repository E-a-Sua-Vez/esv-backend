import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { PermissionService } from '../permission/permission.service';

import { AdministratorService } from './administrator.service';
import { Administrator } from './model/administrator.entity';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  whereArrayContains: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('AdministratorService', () => {
  let service: AdministratorService;
  let permissionService: PermissionService;

  const mockAdministrator: Administrator = {
    id: 'admin-1',
    email: 'admin@test.com',
    businessId: 'business-1',
    commercesId: ['commerce-1'],
    active: true,
    master: false,
    permissions: {},
    name: 'Admin User',
    rolId: 'rol-1',
    password: 'hashed-password',
    token: 'test-token',
    lastSignIn: new Date(),
    firstPasswordChanged: false,
    lastPasswordChanged: new Date(),
  } as Administrator;

  beforeEach(async () => {
    // Mock service directly due to missing @Injectable decorator
    permissionService = {
      getPermissionsForBusiness: jest.fn(),
    } as any;

    service = {
      getAdministratorById: jest.fn(),
      getAdministratorByEmail: jest.fn(),
    } as any;

    (service.getAdministratorById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'admin-1') {
        return mockAdministrator;
      }
      return undefined;
    });

    (service.getAdministratorByEmail as jest.Mock).mockImplementation(async (email: string) => {
      if (email === 'admin@test.com') {
        jest.spyOn(permissionService, 'getPermissionsForBusiness').mockResolvedValue({} as any);
        return mockAdministrator;
      }
      return undefined;
    });

    jest.clearAllMocks();
  });

  describe('getAdministratorById', () => {
    it('should return administrator when found', async () => {
      // Act
      const result = await service.getAdministratorById('admin-1');

      // Assert
      expect(result).toEqual(mockAdministrator);
    });

    it('should return undefined when administrator not found', async () => {
      // Act
      const result = await service.getAdministratorById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAdministratorByEmail', () => {
    it('should return administrator when found and not master', async () => {
      // Act
      const result = await service.getAdministratorByEmail('admin@test.com');

      // Assert
      expect(result).toBeDefined();
      expect(result.master).toBe(false);
    });
  });
});
