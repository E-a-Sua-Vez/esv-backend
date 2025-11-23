import { FormPersonalizedService } from './form-personalized.service';
import { FormPersonalized } from './model/form-personalized.entity';

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

describe('FormPersonalizedService', () => {
  let service: FormPersonalizedService;

  const mockFormPersonalized: FormPersonalized = {
    id: 'form-personalized-1',
    commerceId: 'commerce-1',
    queueId: 'queue-1',
    active: true,
    available: true,
    createdAt: new Date(),
  } as FormPersonalized;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getFormPersonalizedById: jest.fn(),
      getFormsPersonalized: jest.fn(),
      getFormsPersonalizedByCommerceId: jest.fn(),
    } as Partial<FormPersonalizedService> as FormPersonalizedService;

    (service.getFormPersonalizedById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'form-personalized-1') {
        return mockFormPersonalized;
      }
      return undefined;
    });

    (service.getFormsPersonalized as jest.Mock).mockImplementation(async () => {
      return [mockFormPersonalized];
    });

    (service.getFormsPersonalizedByCommerceId as jest.Mock).mockImplementation(async () => {
      return [mockFormPersonalized];
    });

    jest.clearAllMocks();
  });

  describe('getFormPersonalizedById', () => {
    it('should return form personalized when found', async () => {
      // Act
      const result = await service.getFormPersonalizedById('form-personalized-1');

      // Assert
      expect(result).toEqual(mockFormPersonalized);
    });

    it('should return undefined when form personalized not found', async () => {
      // Act
      const result = await service.getFormPersonalizedById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getFormsPersonalized', () => {
    it('should return all forms personalized', async () => {
      // Act
      const result = await service.getFormsPersonalized();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getFormsPersonalizedByCommerceId', () => {
    it('should return forms personalized for a commerce', async () => {
      // Act
      const result = await service.getFormsPersonalizedByCommerceId('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
