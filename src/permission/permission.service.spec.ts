import { Test, TestingModule } from '@nestjs/testing';

import { BusinessService } from '../business/business.service';
import { CommerceService } from '../commerce/commerce.service';
import { UserType } from '../commerce/model/user-type.enum';
import { PlanService } from '../plan/plan.service';
import { PlanActivationService } from '../plan-activation/plan-activation.service';
import { RolService } from '../rol/rol.service';

import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let rolService: RolService;
  let planService: PlanService;
  let businessService: BusinessService;
  let commerceService: CommerceService;
  let planActivationService: PlanActivationService;

  const mockRol = {
    id: 'rol-1',
    name: UserType.BUSINESS,
    permissions: { read: true, write: false },
  } as any;

  const mockBusiness = {
    id: 'business-1',
    planId: 'plan-1',
  } as any;

  const mockPlan = {
    id: 'plan-1',
    permissions: { read: true, write: true },
  } as any;

  const mockPlanActivation = {
    id: 'activation-1',
    permissions: { read: true, write: true, delete: true },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: RolService,
          useValue: {
            getRolByName: jest.fn(),
          },
        },
        {
          provide: PlanService,
          useValue: {
            getPlanById: jest.fn(),
          },
        },
        {
          provide: BusinessService,
          useValue: {
            getBusinessById: jest.fn(),
          },
        },
        {
          provide: CommerceService,
          useValue: {
            getCommerceById: jest.fn(),
          },
        },
        {
          provide: PlanActivationService,
          useValue: {
            getValidatedPlanActivationByBusinessId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    rolService = module.get<RolService>(RolService);
    planService = module.get<PlanService>(PlanService);
    businessService = module.get<BusinessService>(BusinessService);
    commerceService = module.get<CommerceService>(CommerceService);
    planActivationService = module.get<PlanActivationService>(PlanActivationService);

    jest.clearAllMocks();
  });

  describe('getPermissionsForBusiness', () => {
    it('should return merged permissions from rol, plan, and user', async () => {
      // Arrange
      jest.spyOn(rolService, 'getRolByName').mockResolvedValue(mockRol);
      jest.spyOn(businessService, 'getBusinessById').mockResolvedValue(mockBusiness);
      jest.spyOn(planService, 'getPlanById').mockResolvedValue(mockPlan);
      jest
        .spyOn(planActivationService, 'getValidatedPlanActivationByBusinessId')
        .mockResolvedValue(mockPlanActivation);

      const userPermissions = { custom: true };

      // Act
      const result = await service.getPermissionsForBusiness('business-1', userPermissions);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should return permissions when only rol exists', async () => {
      // Arrange
      jest.spyOn(rolService, 'getRolByName').mockResolvedValue(mockRol);
      jest.spyOn(businessService, 'getBusinessById').mockResolvedValue({ id: 'business-1' } as any);

      // Act
      const result = await service.getPermissionsForBusiness('business-1', {});

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('getPermissionsForMaster', () => {
    it('should return permissions for master role', async () => {
      // Arrange
      const masterRol = { ...mockRol, name: UserType.MASTER };
      jest.spyOn(rolService, 'getRolByName').mockResolvedValue(masterRol);

      // Act
      const result = await service.getPermissionsForMaster();

      // Assert
      expect(result).toBeDefined();
      expect(rolService.getRolByName).toHaveBeenCalledWith(UserType.MASTER);
    });
  });
});
