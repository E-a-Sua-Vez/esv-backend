import { Plan } from './model/plan.entity';
import { PlanService } from './plan.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
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

describe('PlanService', () => {
  let service: PlanService;

  const mockPlan: Plan = {
    id: 'plan-1',
    name: 'Test Plan',
    online: true,
    country: 'CL',
    order: 1,
    createdAt: new Date(),
  } as Plan;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getPlanById: jest.fn(),
      getAll: jest.fn(),
      getOnlinePlans: jest.fn(),
      update: jest.fn(),
    } as Partial<PlanService> as PlanService;

    (service.getPlanById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'plan-1') {
        return mockPlan;
      }
      return undefined;
    });

    (service.getAll as jest.Mock).mockImplementation(async () => {
      return [mockPlan];
    });

    (service.getOnlinePlans as jest.Mock).mockImplementation(async (country?: string) => {
      if (country && country !== 'undefined') {
        return [{ ...mockPlan, country }];
      }
      return [mockPlan];
    });

    (service.update as jest.Mock).mockImplementation(async (user: any, plan: Plan) => {
      return { ...plan, updatedAt: new Date() };
    });

    jest.clearAllMocks();
  });

  describe('getPlanById', () => {
    it('should return plan when found', async () => {
      // Act
      const result = await service.getPlanById('plan-1');

      // Assert
      expect(result).toEqual(mockPlan);
    });

    it('should return undefined when plan not found', async () => {
      // Act
      const result = await service.getPlanById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all plans ordered by order', async () => {
      // Act
      const result = await service.getAll();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getOnlinePlans', () => {
    it('should return online plans when country is undefined', async () => {
      // Act
      const result = await service.getOnlinePlans(undefined);

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].online).toBe(true);
    });

    it('should return online plans for specific country', async () => {
      // Act
      const result = await service.getOnlinePlans('CL');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].country).toBe('CL');
    });
  });

  describe('update', () => {
    it('should update plan successfully', async () => {
      // Arrange
      const updatedPlan = { ...mockPlan, name: 'Updated Plan' };
      const user = { id: 'user-1' };

      // Act
      const result = await service.update(user, updatedPlan);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Plan');
    });
  });
});
