import { HttpException, HttpStatus } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { FeatureToggleDetailsDto } from './dto/feature-toggle-details.dto';
import FeatureToggleCreated from './events/FeatureToggleCreated';
import FeatureToggleUpdated from './events/FeatureToggleUpdated';
import { FeatureToggle, FeatureToggleOption } from './model/feature-toggle.entity';
import { FeatureToggleName } from './model/feature-toggle.enum';
import * as features from './model/features.json';

export class FeatureToggleService {
  constructor(
    @InjectRepository(FeatureToggle)
    private featureToggleRepository = getRepository(FeatureToggle)
  ) {}

  public async getFeatureToggleById(id: string): Promise<FeatureToggle> {
    return await this.featureToggleRepository.findById(id);
  }
  public async getFeatureToggleByName(name: string): Promise<FeatureToggle> {
    const result = await this.featureToggleRepository.whereEqualTo('name', name).find();
    return result[0];
  }
  public async getFeatureToggleByType(type: FeatureToggleName): Promise<FeatureToggle[]> {
    return await this.featureToggleRepository.whereEqualTo('type', type).find();
  }
  public async getFeatureToggleByCommerceId(commerceId: string): Promise<FeatureToggle[]> {
    const result = await this.featureToggleRepository
      .whereEqualTo('commerceId', commerceId)
      .orderByAscending('type')
      .find();
    return result;
  }
  public async getFeatureToggleDetailsByCommerceId(
    commerceId: string
  ): Promise<FeatureToggleDetailsDto[]> {
    const result: FeatureToggleDetailsDto[] = [];
    const features = await this.featureToggleRepository
      .whereEqualTo('commerceId', commerceId)
      .orderByAscending('type')
      .find();
    if (features && features.length > 0) {
      features.forEach(feature => {
        const featureToggleDetailsDto: FeatureToggleDetailsDto = new FeatureToggleDetailsDto();
        featureToggleDetailsDto.name = feature.name;
        featureToggleDetailsDto.active = feature.active;
        featureToggleDetailsDto.type = feature.type;
        result.push(featureToggleDetailsDto);
      });
    }
    return result;
  }
  public async getFeatureToggleByNameAndCommerceId(
    commerceId: string,
    name: string
  ): Promise<FeatureToggle> {
    if (!commerceId) {
      // Evitar consultas inválidas contra Firestore/FireORM
      return undefined;
    }
    const result = await this.featureToggleRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('name', name)
      .find();
    return result[0];
  }
  public async getFeatureToggleByCommerceAndType(
    commerceId: string,
    type: FeatureToggleName
  ): Promise<FeatureToggle[]> {
    const result = await this.featureToggleRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('type', type)
      .find();
    return result;
  }
  public getFeatureToggleOptions(): FeatureToggleOption[] {
    const options = features;
    return options.sort((a, b) => (a.type < b.type ? -1 : 1));
  }
  public async createFeatureToggle(
    user: string,
    name: string,
    commerceId: string,
    type: string
  ): Promise<FeatureToggle> {
    if (!name || !type || !commerceId) {
      throw new HttpException(
        'Bad request: "name", "type" y "commerceId" son obligatorios',
        HttpStatus.BAD_REQUEST
      );
    }
    const existingFeature = await this.getFeatureToggleByNameAndCommerceId(commerceId, name);
    if (existingFeature !== undefined) {
      throw new HttpException('feature-toggle ya existe para este comercio', HttpStatus.FOUND);
    }
    const feature = new FeatureToggle();
    feature.name = name;
    feature.commerceId = commerceId;
    feature.type = type;
    feature.active = true;
    feature.createdAt = new Date();
    const featureCreated = await this.featureToggleRepository.create(feature);
    const featureCreatedEvent = new FeatureToggleCreated(new Date(), featureCreated, { user });
    publish(featureCreatedEvent);
    return featureCreated;
  }
  public async update(user, feature: FeatureToggle): Promise<FeatureToggle> {
    const featureUpdated = await this.featureToggleRepository.update(feature);
    const featureUpdatedEvent = new FeatureToggleUpdated(new Date(), featureUpdated, { user });
    publish(featureUpdatedEvent);
    return featureUpdated;
  }
  public async updateFeatureToggle(
    user: string,
    id: string,
    active: boolean
  ): Promise<FeatureToggle> {
    const commerce = await this.getFeatureToggleById(id);
    if (active !== undefined) {
      commerce.active = active;
    }
    return await this.update(user, commerce);
  }
}
