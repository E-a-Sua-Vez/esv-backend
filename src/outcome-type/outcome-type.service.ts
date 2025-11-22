import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import OutcomeTypeCreated from './events/OutcomeTypeCreated';
import OutcomeTypeUpdated from './events/OutcomeTypeUpdated';
import { OutcomeTypeType } from './model/outcome-type-type.enum';
import { OutcomeType } from './model/outcome-type.entity';

@Injectable()
export class OutcomeTypeService {
  constructor(
    @InjectRepository(OutcomeType)
    private outcomeTypeRepository = getRepository(OutcomeType)
  ) {}

  public async getOutcomeTypeById(id: string): Promise<OutcomeType> {
    const outcomeType = await this.outcomeTypeRepository.findById(id);
    return outcomeType;
  }

  public async getOutcomeTypes(): Promise<OutcomeType[]> {
    let outcomeTypes: OutcomeType[] = [];
    outcomeTypes = await this.outcomeTypeRepository.find();
    return outcomeTypes;
  }

  public async getOutcomeTypeByCommerce(commerceId: string): Promise<OutcomeType[]> {
    let outcomeTypes: OutcomeType[] = [];
    outcomeTypes = await this.outcomeTypeRepository.whereEqualTo('commerceId', commerceId).find();
    return outcomeTypes;
  }

  public async getOutcomeTypesById(outcomeTypesId: string[]): Promise<OutcomeType[]> {
    let outcomeTypes: OutcomeType[] = [];
    outcomeTypes = await this.outcomeTypeRepository.whereIn('id', outcomeTypesId).find();
    return outcomeTypes;
  }

  public async updateOutcomeTypeConfigurations(
    user: string,
    id: string,
    name: string,
    tag: string,
    active: boolean,
    available: boolean
  ): Promise<OutcomeType> {
    try {
      const outcomeType = await this.outcomeTypeRepository.findById(id);
      if (name !== undefined) {
        outcomeType.name = name;
      }
      if (tag !== undefined) {
        outcomeType.tag = tag;
      }
      if (active !== undefined) {
        outcomeType.active = active;
      }
      if (available !== undefined) {
        outcomeType.available = available;
      }
      return await this.updateOutcomeType(user, outcomeType);
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el servicio: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async updateOutcomeType(user: string, outcomeType: OutcomeType): Promise<OutcomeType> {
    const outcomeTypeUpdated = await await this.outcomeTypeRepository.update(outcomeType);
    const outcomeTypeUpdatedEvent = new OutcomeTypeUpdated(new Date(), outcomeTypeUpdated, {
      user,
    });
    publish(outcomeTypeUpdatedEvent);
    return outcomeTypeUpdated;
  }

  public async createOutcomeType(
    user: string,
    commerceId: string,
    type: OutcomeTypeType,
    name: string,
    tag: string
  ): Promise<OutcomeType> {
    const outcomeType = new OutcomeType();
    outcomeType.commerceId = commerceId;
    outcomeType.type = type || OutcomeTypeType.STANDARD;
    outcomeType.createdAt = new Date();
    outcomeType.name = name;
    outcomeType.tag = tag;
    outcomeType.active = true;
    outcomeType.available = true;
    const outcomeTypeCreated = await this.outcomeTypeRepository.create(outcomeType);
    const outcomeTypeCreatedEvent = new OutcomeTypeCreated(new Date(), outcomeTypeCreated, {
      user,
    });
    publish(outcomeTypeCreatedEvent);
    return outcomeTypeCreated;
  }
}
