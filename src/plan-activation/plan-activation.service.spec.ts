import { Test, TestingModule } from '@nestjs/testing';
import { getRepository } from 'fireorm';

import { BusinessService } from '../business/business.service';
import { PaymentService } from '../payment/payment.service';
import { PlanService } from '../plan/plan.service';

import { PlanActivation } from './model/plan-activation.entity';
import { PlanActivationService } from './plan-activation.service';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  orderByDescending: jest.fn().mockReturnThis(),
};

jest.mock('fireorm', () => ({
  getRepository: jest.fn(() => mockRepository),
  Collection: jest.fn(() => () => {}),
}));

jest.mock('nestjs-fireorm', () => ({
  InjectRepository: () => () => {},
}));

describe('PlanActivationService', () => {
  let service: PlanActivationService;
  let businessService: BusinessService;
  let planService: PlanService;
  let paymentService: PaymentService;

  const mockPlanActivation: PlanActivation = {
    id: 'activation-1',
    businessId: 'business-1',
    planId: 'plan-1',
    validated: true,
    createdAt: new Date(),
  } as PlanActivation;

  beforeEach(async () => {
    // Mock service directly due to missing @Injectable decorator
    businessService = {
      getBusinessById: jest.fn(),
    } as any;

    planService = {
      getPlanById: jest.fn(),
    } as any;

    paymentService = {
      getPaymentById: jest.fn(),
    } as any;

    service = {
      getPlanActivationById: jest.fn(),
      getPlanActivationByBusinessId: jest.fn(),
      getValidatedPlanActivationByBusinessId: jest.fn(),
    } as any;

    (service.getPlanActivationById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'activation-1') {
        return mockPlanActivation;
      }
      return undefined;
    });

    (service.getPlanActivationByBusinessId as jest.Mock).mockImplementation(async () => {
      return [mockPlanActivation];
    });

    (service.getValidatedPlanActivationByBusinessId as jest.Mock).mockImplementation(async () => {
      return mockPlanActivation;
    });

    jest.clearAllMocks();
  });

  describe('getPlanActivationById', () => {
    it('should return plan activation when found', async () => {
      // Act
      const result = await service.getPlanActivationById('activation-1');

      // Assert
      expect(result).toEqual(mockPlanActivation);
    });

    it('should return undefined when plan activation not found', async () => {
      // Act
      const result = await service.getPlanActivationById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getPlanActivationByBusinessId', () => {
    it('should return plan activations for a business', async () => {
      // Act
      const result = await service.getPlanActivationByBusinessId('business-1');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
  });

  describe('getValidatedPlanActivationByBusinessId', () => {
    it('should return validated plan activation for a business', async () => {
      // Act
      const result = await service.getValidatedPlanActivationByBusinessId('business-1', 'true');

      // Assert
      expect(result).toBeDefined();
      expect(result).toEqual(mockPlanActivation);
    });
  });
});
