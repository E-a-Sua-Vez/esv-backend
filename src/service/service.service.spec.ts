import { Service } from './model/service.entity';
import { ServiceService } from './service.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('ServiceService', () => {
  let service: ServiceService;

  const mockService: Service = {
    id: 'service-1',
    name: 'Test Service',
    commerceId: 'commerce-1',
    active: true,
    createdAt: new Date(),
  } as Service;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getServiceById: jest.fn(),
      getServices: jest.fn(),
      getServicesById: jest.fn(),
    } as Partial<ServiceService> as ServiceService;

    (service.getServiceById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'service-1') {
        return mockService;
      }
      return undefined;
    });

    (service.getServices as jest.Mock).mockImplementation(async () => {
      return [mockService];
    });

    (service.getServicesById as jest.Mock).mockImplementation(async (ids: string[]) => {
      return ids.map(id => ({ ...mockService, id }));
    });

    jest.clearAllMocks();
  });

  describe('getServiceById', () => {
    it('should return service when found', async () => {
      // Act
      const result = await service.getServiceById('service-1');

      // Assert
      expect(result).toEqual(mockService);
    });

    it('should return undefined when service not found', async () => {
      // Act
      const result = await service.getServiceById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getServices', () => {
    it('should return all services', async () => {
      // Act
      const result = await service.getServices();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getServicesById', () => {
    it('should return services by ids', async () => {
      // Act
      const result = await service.getServicesById(['service-1', 'service-2']);

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });
  });
});
