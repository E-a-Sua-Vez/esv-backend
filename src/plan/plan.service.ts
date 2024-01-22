import { Plan } from './model/plan.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import PlanUpdated from './events/PlanUpdated';
import PlanCreated from './events/PlanCreated';
import { Periodicity } from './model/periodicity.enum';

export class PlanService {
  constructor(
  @InjectRepository(Plan)
    private planRepository = getRepository(Plan)
  ) {}

  public async getPlanById(id: string): Promise<Plan> {
    return await this.planRepository.findById(id);
  }

  public async getAll(): Promise<Plan[]> {
    return await this.planRepository
      .orderByAscending('order')
      .find();
  }

  public async getOnlinePlans(country: string): Promise<Plan[]> {
    if (country === 'undefined' || country === undefined || !country) {
      return await this.planRepository
        .whereEqualTo('online', true)
        .orderByAscending('order')
        .find();
    }
    return await this.planRepository
        .whereEqualTo('country', country)
        .whereEqualTo('online', true)
        .orderByAscending('order')
        .find();

  }

  public async update(user, plan: Plan): Promise<Plan> {
    const planUpdated = await this.planRepository.update(plan);
    const planUpdatedEvent = new PlanUpdated(new Date(), planUpdated, { user });
    publish(planUpdatedEvent);
    return planUpdated;
  }

  public async createPlan(user: string, name: string, country: string, description: string, price: number, periodicity: Periodicity, order: number, online, onlinePrice: number, saving: number, onlineSaving: number): Promise<Plan> {
    let plan = new Plan();
    plan.name = name;
    plan.country = country;
    plan.description = description;
    plan.price = price;
    plan.periodicity = periodicity;
    plan.order = order;
    plan.active = true;
    plan.permissions = {};
    plan.createdAt = new Date();
    plan.online = online || false;
    plan.onlinePrice = onlinePrice;
    plan.saving = saving;
    plan.onlineSaving = onlineSaving;
    const planCreated = await this.planRepository.create(plan);
    const planCreatedEvent = new PlanCreated(new Date(), planCreated, { user });
    publish(planCreatedEvent);
    return planCreated;
  }

  public async updatePlanPermission(user: string, id: string, permissionName: string, permissionValue: boolean|number): Promise<Plan> {
    let plan = await this.getPlanById(id);
    if (plan) {
      if (plan.permissions) {
        plan.permissions[permissionName] = permissionValue;
      }
    }
    return await this.update(user, plan);
  }

  public async updatePlanConfigurations(user: string, id: string, name: string, country: string, description: string, periodicity: Periodicity, order: number, price: number, active, online, onlinePrice: number, saving: number, onlineSaving: number): Promise<Plan> {
    try {
      let plan = await this.planRepository.findById(id);
      if (name) {
        plan.name = name;
      }
      if (country) {
        plan.country = country;
      }
      if (description) {
        plan.description = description;
      }
      if (periodicity) {
        plan.periodicity = periodicity;
      }
      if (order) {
        plan.order = order;
      }
      if (price) {
        plan.price = price;
      }
      if (onlinePrice) {
        plan.onlinePrice = onlinePrice;
      }
      if (onlinePrice) {
        plan.onlinePrice = onlinePrice;
      }
      if (saving) {
        plan.saving = saving;
      }
      if (onlineSaving) {
        plan.onlineSaving = onlineSaving;
      }
      if (active !== undefined) {
        plan.active = active;
      }
      if (online !== undefined) {
        plan.online = online;
      }
      const planUpdated = await this.planRepository.update(plan);
      const planUpdatedEvent = new PlanUpdated(new Date(), planUpdated, { user });
      publish(planUpdatedEvent);
      return planUpdated;
    } catch (error) {
      throw `Hubo un problema al modificar el plan: ${error.message}`;
    }
  }

  public async activatedPermissionsForPlan(planId: string): Promise<Record<string, number | boolean>> {
    const permissions = {};
    let planPermissions = {};
    const plan = await this.getPlanById(planId);
    if (plan && plan.permissions) {
      planPermissions = plan.permissions;
    }
    if (Object.keys(planPermissions).length > 0) {
      Object.keys(planPermissions).forEach(permission => {
        if (planPermissions[permission] === false) {
          permissions[permission] = true;
        } else {
          permissions[permission] = planPermissions[permission];
        }
      })
    }
    return permissions;
  }

  public async desactivatedPermissionsForPlan(planId: string): Promise<Record<string, number | boolean>> {
    const permissions = {};
    let planPermissions = {};
    const fixedExclutions = [
      'business.main-menu.your-plan',
      'plan.admin.edit',
      'plan.admin.view',
      'plan.admin.update'
    ]
    const plan = await this.getPlanById(planId);
    if (plan && plan.permissions) {
      planPermissions = plan.permissions;
    }
    if (Object.keys(planPermissions).length > 0) {
      Object.keys(planPermissions).forEach(permission => {
        if (planPermissions[permission] === true) {
          permissions[permission] = false;
        } else {
          permissions[permission] = planPermissions[permission];
        }
        if (fixedExclutions.includes(permission)) {
          permissions[permission] = true;
        }
      })
    }
    return permissions;
  }
}
