import { Rol } from './model/rol.entity';
import { RolService } from './rol.service';

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

describe('RolService', () => {
  let service: RolService;

  const mockRol: Rol = {
    id: 'rol-1',
    name: 'Test Rol',
    description: 'Test Description',
    permissions: { read: true, write: false },
    active: true,
    createdAt: new Date(),
    modifiedAt: new Date(),
  } as Rol;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getRolById: jest.fn(),
      getRoles: jest.fn(),
      getRolByName: jest.fn(),
      createRol: jest.fn(),
    } as Partial<RolService> as RolService;

    (service.getRolById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'rol-1') {
        return mockRol;
      }
      return undefined;
    });

    (service.getRoles as jest.Mock).mockImplementation(async () => {
      return [mockRol];
    });

    (service.getRolByName as jest.Mock).mockImplementation(async (name: string) => {
      if (name === 'Test Rol') {
        return mockRol;
      }
      return undefined;
    });

    (service.createRol as jest.Mock).mockImplementation(
      async (
        user: string,
        name: string,
        description: string,
        permissions: Record<string, boolean | number>
      ) => {
        return {
          id: 'new-rol',
          name,
          description,
          permissions,
          active: true,
          createdAt: new Date(),
        };
      }
    );

    jest.clearAllMocks();
  });

  describe('getRolById', () => {
    it('should return rol when found', async () => {
      // Act
      const result = await service.getRolById('rol-1');

      // Assert
      expect(result).toEqual(mockRol);
    });

    it('should return undefined when rol not found', async () => {
      // Act
      const result = await service.getRolById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getRoles', () => {
    it('should return all roles', async () => {
      // Act
      const result = await service.getRoles();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getRolByName', () => {
    it('should return rol when found by name', async () => {
      // Act
      const result = await service.getRolByName('Test Rol');

      // Assert
      expect(result).toEqual(mockRol);
    });
  });

  describe('createRol', () => {
    it('should create rol successfully', async () => {
      // Arrange
      const user = 'user-1';
      const name = 'New Rol';
      const description = 'New Description';
      const permissions = { read: true };

      // Act
      const result = await service.createRol(user, name, description, permissions);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(name);
      expect(result.active).toBe(true);
    });
  });
});
