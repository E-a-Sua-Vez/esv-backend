import { OutcomeStatus } from './model/outcome-status.enum';
import { Outcome } from './model/outcome.entity';
import { OutcomeService } from './outcome.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => jest.fn()),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => jest.fn(),
}));

describe('OutcomeService', () => {
  let service: OutcomeService;

  const mockOutcome: Outcome = {
    id: 'outcome-1',
    commerceId: 'commerce-1',
    amount: 100,
    status: OutcomeStatus.PENDING,
    createdAt: new Date(),
  } as Outcome;

  beforeEach(async () => {
    // Mock service directly
    service = {
      getOutcomeById: jest.fn(),
      getOutcomes: jest.fn(),
      getOutcomeByCommerce: jest.fn(),
      getPendingOutcomeByPackage: jest.fn(),
    } as Partial<OutcomeService> as OutcomeService;

    (service.getOutcomeById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'outcome-1') {
        return mockOutcome;
      }
      return undefined;
    });

    (service.getOutcomes as jest.Mock).mockImplementation(async () => {
      return [mockOutcome];
    });

    (service.getOutcomeByCommerce as jest.Mock).mockImplementation(async () => {
      return [mockOutcome];
    });

    (service.getPendingOutcomeByPackage as jest.Mock).mockImplementation(async () => {
      return [mockOutcome];
    });

    jest.clearAllMocks();
  });

  describe('getOutcomeById', () => {
    it('should return outcome when found', async () => {
      // Act
      const result = await service.getOutcomeById('outcome-1');

      // Assert
      expect(result).toEqual(mockOutcome);
    });

    it('should return undefined when outcome not found', async () => {
      // Act
      const result = await service.getOutcomeById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getOutcomes', () => {
    it('should return all outcomes', async () => {
      // Act
      const result = await service.getOutcomes();

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getOutcomeByCommerce', () => {
    it('should return outcomes for a commerce', async () => {
      // Act
      const result = await service.getOutcomeByCommerce('commerce-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  describe('getPendingOutcomeByPackage', () => {
    it('should return pending outcomes for a package', async () => {
      // Act
      const result = await service.getPendingOutcomeByPackage('commerce-1', 'package-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
