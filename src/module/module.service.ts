import { Module } from './module.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import ModuleCreated from './events/ModuleCreated';
import ModuleUpdated from './events/ModuleUpdated';
import { HttpException, HttpStatus } from '@nestjs/common';

export class ModuleService {
  constructor(
  @InjectRepository(Module)
    private moduleRepository = getRepository(Module)
  ) {}

  public async getModuleById(id: string): Promise<Module> {
    return await this.moduleRepository.findById(id);
  }

  public async getAllModule(): Promise<Module[]> {
    return await this.moduleRepository
    .whereEqualTo('available', true)
    .orderByAscending('name')
    .find();
  }

  public async getModulesByCommerceId(commerceId: string): Promise<Module[]> {
    return await this.moduleRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('available', true)
    .orderByAscending('name')
    .find();
  }

  public async getActiveModulesByCommerceId(commerceId: string): Promise<Module[]> {
    return await this.moduleRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('active', true)
    .whereEqualTo('available', true)
    .orderByAscending('name')
    .find();
  }

  public async createModule(user: string, commerceId: string, name: string): Promise<Module> {
    let module = new Module();
    module.commerceId = commerceId;
    module.name = name;
    module.active = true;
    module.available = true;
    module.createdAt = new Date();
    const moduleCreated = await this.moduleRepository.create(module);
    const moduleCreatedEvent = new ModuleCreated(new Date(), moduleCreated, { user });
    publish(moduleCreatedEvent);
    return moduleCreated;
  }

  public async updateModuleConfigurations(user: string, id: string, name: string, active, available): Promise<Module> {
    try {
      let module = await this.moduleRepository.findById(id);
      if (name) {
        module.name = name;
      }
      if (active !== undefined) {
        module.active = active;
      }
      if (available !== undefined) {
        module.available = available;
      }
      const moduleUpdated = await this.moduleRepository.update(module);
      const moduleUpdatedEvent = new ModuleUpdated(new Date(), moduleUpdated, { user });
      publish(moduleUpdatedEvent);
      return moduleUpdated;
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el modulo: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
