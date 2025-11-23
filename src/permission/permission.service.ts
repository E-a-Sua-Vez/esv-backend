import { Injectable } from '@nestjs/common';
import { CommerceService } from 'src/commerce/commerce.service';
import { RolService } from 'src/rol/rol.service';

import { BusinessService } from '../business/business.service';
import { UserType } from '../commerce/model/user-type.enum';
import { PlanService } from '../plan/plan.service';
import { PlanActivationService } from '../plan-activation/plan-activation.service';

@Injectable()
export class PermissionService {
  constructor(
    private readonly rolService: RolService,
    private readonly planService: PlanService,
    private readonly businessService: BusinessService,
    private readonly commerceService: CommerceService,
    private readonly planActivationService: PlanActivationService
  ) {}

  public async getPermissionsForBusiness(
    businessId: string,
    userPermissions: Record<string, number | boolean>
  ): Promise<Record<string, number | boolean>> {
    const permissions = {};
    let rolPermissions = {};
    let planPermissions = {};
    let planActivatedPermissions = {};
    const rol = await this.rolService.getRolByName(UserType.BUSINESS);
    if (rol && rol.permissions) {
      rolPermissions = rol.permissions;
    }
    const business = await this.businessService.getBusinessById(businessId);
    if (business && business.planId) {
      const plan = await this.planService.getPlanById(business.planId);
      if (plan && plan.permissions) {
        planPermissions = plan.permissions;
      }
      const planActivated = await this.planActivationService.getValidatedPlanActivationByBusinessId(
        business.id,
        'true'
      );
      if (planActivated && planActivated.permissions) {
        planActivatedPermissions = planActivated.permissions;
      }
    }
    if (Object.keys(rolPermissions).length > 0) {
      Object.keys(rolPermissions).forEach(permission => {
        permissions[permission] = rolPermissions[permission];
      });
    }
    if (Object.keys(planPermissions).length > 0) {
      Object.keys(planPermissions).forEach(permission => {
        if (permissions[permission]) {
          permissions[permission] = planPermissions[permission];
        }
      });
    }
    if (Object.keys(planActivatedPermissions).length > 0) {
      Object.keys(planActivatedPermissions).forEach(permission => {
        if (permissions[permission]) {
          permissions[permission] = planActivatedPermissions[permission];
        }
      });
    }
    if (Object.keys(userPermissions).length > 0) {
      Object.keys(userPermissions).forEach(permission => {
        permissions[permission] = userPermissions[permission];
      });
    }
    return permissions;
  }

  public async getPermissionsForCollaborator(
    commerceId: string,
    userPermissions: Record<string, number | boolean>
  ): Promise<Record<string, number | boolean>> {
    const permissions = {};
    let rolPermissions = {};
    let planPermissions = {};
    let planActivatedPermissions = {};
    const rol = await this.rolService.getRolByName(UserType.COLLABORATOR);
    if (rol && rol.permissions) {
      rolPermissions = rol.permissions;
    }
    const commerce = await this.commerceService.getCommerceById(commerceId);
    if (commerce && commerce.businessId) {
      const business = await this.businessService.getBusinessById(commerce.businessId);
      if (business && business.planId) {
        const plan = await this.planService.getPlanById(business.planId);
        if (plan && plan.permissions) {
          planPermissions = plan.permissions;
        }
        const planActivated =
          await this.planActivationService.getValidatedPlanActivationByBusinessId(
            business.id,
            'true'
          );
        if (planActivated && planActivated.permissions) {
          planActivatedPermissions = planActivated.permissions;
        }
      }
    }
    if (Object.keys(rolPermissions).length > 0) {
      Object.keys(rolPermissions).forEach(permission => {
        permissions[permission] = rolPermissions[permission];
      });
    }
    if (Object.keys(planPermissions).length > 0) {
      Object.keys(planPermissions).forEach(permission => {
        if (permissions[permission]) {
          permissions[permission] = planPermissions[permission];
        }
      });
    }
    if (Object.keys(planActivatedPermissions).length > 0) {
      Object.keys(planActivatedPermissions).forEach(permission => {
        if (permissions[permission]) {
          permissions[permission] = planActivatedPermissions[permission];
        }
      });
    }
    if (Object.keys(userPermissions).length > 0) {
      Object.keys(userPermissions).forEach(permission => {
        permissions[permission] = userPermissions[permission];
      });
    }
    return permissions;
  }

  public async getPermissionsForMaster(): Promise<Record<string, number | boolean>> {
    const permissions = {};
    let rolPermissions = {};

    const rol = await this.rolService.getRolByName(UserType.MASTER);
    if (rol && rol.permissions) {
      rolPermissions = rol.permissions;
    }

    if (Object.keys(rolPermissions).length > 0) {
      Object.keys(rolPermissions).forEach(permission => {
        permissions[permission] = rolPermissions[permission];
      });
    }

    return permissions;
  }
}
