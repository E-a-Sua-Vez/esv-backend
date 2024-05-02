import { PatientHistoryItem } from './model/patient-history-item.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import PatientHistoryItemCreated from './events/PatientHistoryItemCreated';
import PatientHistoryItemUpdated from './events/PatientHistoryItemUpdated';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PatientHistoryItemType } from './model/patient-history-type.enum';

export class PatientHistoryItemService {
  constructor(
  @InjectRepository(PatientHistoryItem)
    private moduleRepository = getRepository(PatientHistoryItem)
  ) {}

  public async getPatientHistoryItemById(id: string): Promise<PatientHistoryItem> {
    return await this.moduleRepository.findById(id);
  }

  public async getAllPatientHistoryItem(): Promise<PatientHistoryItem[]> {
    return await this.moduleRepository
    .whereEqualTo('available', true)
    .orderByAscending('name')
    .find();
  }

  public async getPatientHistoryItemsByCommerceId(commerceId: string): Promise<PatientHistoryItem[]> {
    return await this.moduleRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('available', true)
    .orderByAscending('name')
    .find();
  }

  public async getActivePatientHistoryItemsByCommerceId(commerceId: string): Promise<PatientHistoryItem[]> {
    return await this.moduleRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('active', true)
    .whereEqualTo('available', true)
    .orderByAscending('name')
    .find();
  }

  public async getActivePatientHistoryItemsByCommerceIdAndType(commerceId: string, type: PatientHistoryItemType): Promise<PatientHistoryItem[]> {
    return await this.moduleRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('type', type)
    .whereEqualTo('active', true)
    .whereEqualTo('available', true)
    .orderByAscending('name')
    .find();
  }

  public async createPatientHistoryItem(user: string, commerceId: string, name: string): Promise<PatientHistoryItem> {
    let module = new PatientHistoryItem();
    module.commerceId = commerceId;
    module.name = name;
    module.active = true;
    module.available = true;
    module.createdAt = new Date();
    const moduleCreated = await this.moduleRepository.create(module);
    const moduleCreatedEvent = new PatientHistoryItemCreated(new Date(), moduleCreated, { user });
    publish(moduleCreatedEvent);
    return moduleCreated;
  }

  public async updatePatientHistoryItemConfigurations(user: string, id: string, name: string, active, available): Promise<PatientHistoryItem> {
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
      const moduleUpdatedEvent = new PatientHistoryItemUpdated(new Date(), moduleUpdated, { user });
      publish(moduleUpdatedEvent);
      return moduleUpdated;
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el modulo: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
