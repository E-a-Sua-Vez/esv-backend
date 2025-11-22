import { HttpException, HttpStatus } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import PatientHistoryItemCreated from './events/PatientHistoryItemCreated';
import PatientHistoryItemUpdated from './events/PatientHistoryItemUpdated';
import { ItemCharacteristics, PatientHistoryItem } from './model/patient-history-item.entity';
import { PatientHistoryItemType } from './model/patient-history-type.enum';

export class PatientHistoryItemService {
  constructor(
    @InjectRepository(PatientHistoryItem)
    private patientHistoryItemRepository = getRepository(PatientHistoryItem)
  ) {}

  public async getPatientHistoryItemById(id: string): Promise<PatientHistoryItem> {
    return await this.patientHistoryItemRepository.findById(id);
  }

  public async getAllPatientHistoryItem(): Promise<PatientHistoryItem[]> {
    return await this.patientHistoryItemRepository
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
  }

  public async getPatientHistoryItemsByCommerceId(
    commerceId: string
  ): Promise<PatientHistoryItem[]> {
    return await this.patientHistoryItemRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
  }

  public async getActivePatientHistoryItemsByCommerceId(
    commerceId: string
  ): Promise<PatientHistoryItem[]> {
    return await this.patientHistoryItemRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
  }

  public async getActivePatientHistoryItemsByCommerceIdAndType(
    commerceId: string,
    type: PatientHistoryItemType
  ): Promise<PatientHistoryItem[]> {
    return await this.patientHistoryItemRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('type', type)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('name')
      .find();
  }

  name: string;
  type: PatientHistoryItemType;
  characteristics: ItemCharacteristics;
  commerceId: string;
  createdAt: Date;
  active: boolean;
  available: boolean;

  public async createPatientHistoryItem(
    user: string,
    commerceId: string,
    name: string,
    tag: string,
    order: number,
    type: PatientHistoryItemType,
    characteristics: ItemCharacteristics
  ): Promise<PatientHistoryItem> {
    const item = new PatientHistoryItem();
    item.commerceId = commerceId;
    item.name = name;
    item.type = type;
    item.tag = tag;
    item.order = order;
    item.characteristics = characteristics;
    item.active = true;
    item.online = true;
    item.available = true;
    item.createdAt = new Date();
    const itemCreated = await this.patientHistoryItemRepository.create(item);
    const itemCreatedEvent = new PatientHistoryItemCreated(new Date(), itemCreated, { user });
    publish(itemCreatedEvent);
    return itemCreated;
  }

  public async updatePatientHistoryItemConfigurations(
    user: string,
    id: string,
    name: string,
    tag: string,
    order: number,
    type: PatientHistoryItemType,
    characteristics: ItemCharacteristics,
    active: boolean,
    available: boolean,
    online: boolean
  ): Promise<PatientHistoryItem> {
    try {
      const item = await this.patientHistoryItemRepository.findById(id);
      if (name) {
        item.name = name;
      }
      if (type !== undefined) {
        item.type = type;
      }
      if (tag !== undefined) {
        item.tag = tag;
      }
      if (order !== undefined) {
        item.order = order;
      }
      if (characteristics !== undefined) {
        item.characteristics = characteristics;
      }
      if (active !== undefined) {
        item.active = active;
      }
      if (available !== undefined) {
        item.available = available;
      }
      if (online !== undefined) {
        item.online = online;
      }
      const itemUpdated = await this.patientHistoryItemRepository.update(item);
      const itemUpdatedEvent = new PatientHistoryItemUpdated(new Date(), itemUpdated, { user });
      publish(itemUpdatedEvent);
      return itemUpdated;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el patient history item: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
