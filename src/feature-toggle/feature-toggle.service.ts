import { FeatureToggle, FeatureToggleOption } from './model/feature-toggle.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { FeatureToggleName } from './model/feature-toggle.enum';
import { publish } from 'ett-events-lib';
import FeatureToggleUpdated from './events/FeatureToggleUpdated';
import FeatureToggleCreated from './events/FeatureToggleCreated';
import { HttpException, HttpStatus } from '@nestjs/common';

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
  public async getFeatureToggleByNameAndCommerceId(commerceId: string, name: string): Promise<FeatureToggle> {
    const result = await this.featureToggleRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('name', name)
    .find();
    return result[0];
  }
  public async getFeatureToggleByCommerceAndType(commerceId: string, type: FeatureToggleName): Promise<FeatureToggle[]> {
    const result = await this.featureToggleRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('type', type)
    .find();
    return result;
  }
  public getFeatureToggleOptions(): FeatureToggleOption[] {
    const options = [
      {
        name: 'whatsapp-notify-now',
        type: 'WHATSAPP',
      },
      {
        name: 'whatsapp-notify-five',
        type: 'WHATSAPP',
      },
      {
        name: 'whatsapp-notify-one',
        type: 'WHATSAPP',
      },
      {
        name: 'only-survey',
        type: 'PRODUCT',
      },
      {
        name: 'get-number-remote',
        type: 'PRODUCT'
      },
      {
        name: 'close-commerce-by-service-hours',
        type: 'PRODUCT'
      },
      {
        name: 'attention-user-name',
        type: 'USER'
      },
      {
        name: 'attention-user-lastName',
        type: 'USER'
      },
      {
        name: 'attention-user-phone',
        type: 'USER'
      },
      {
        name: 'attention-user-email',
        type: 'USER'
      },
      {
        name: 'attention-user-birthday',
        type: 'USER'
      },
      {
        name: 'attention-user-address',
        type: 'USER'
      },
      {
        name: 'attention-user-origin',
        type: 'USER'
      },
      {
        name: 'attention-user-code1',
        type: 'USER'
      },
      {
        name: 'attention-user-code2',
        type: 'USER'
      },
      {
        name: 'attention-user-code3',
        type: 'USER'
      },
      {
        name: 'attention-user-idNumber',
        type: 'USER'
      },
      {
        name: 'email-notify-now',
        type: 'EMAIL',
      },
      {
        name: 'email-attention',
        type: 'EMAIL',
      },
      {
        name: 'email-csat',
        type: 'EMAIL',
      },
      {
        name: 'whatsapp-csat',
        type: 'WHATSAPP',
      },
      {
        name: 'email-monthly-commerce-statistics',
        type: 'EMAIL',
      },
      {
        name: 'email-booking',
        type: 'EMAIL',
      },
      {
        name: 'whatsapp-booking',
        type: 'WHATSAPP',
      },
      {
        name: 'booking-active',
        type: 'PRODUCT'
      },
      {
        name: 'booking-block-active',
        type: 'PRODUCT'
      },
      {
        name: 'booking-block-walkin',
        type: 'PRODUCT'
      },
      {
        name: 'attention-user-not-required',
        type: 'PRODUCT'
      },
      {
        name: 'booking-waitlist-active',
        type: 'PRODUCT'
      },
      {
        name: 'email-waitlist',
        type: 'EMAIL',
      },
      {
        name: 'whatsapp-waitlist',
        type: 'WHATSAPP',
      },
      {
        name: 'booking-whatsapp-confirm',
        type: 'WHATSAPP'
      },
      {
        name: 'booking-email-confirm',
        type: 'EMAIL'
      },
      {
        name: 'attention-voice-command',
        type: 'PRODUCT'
      },
      {
        name: 'attention-queue-typegrouped',
        type: 'PRODUCT'
      },
      {
        name: 'booking-confirm',
        type: 'PRODUCT'
      },
      {
        name: 'booking-confirm-payment',
        type: 'PRODUCT'
      },
      {
        name: 'attention-confirm-payment',
        type: 'PRODUCT'
      },
      {
        name: 'attention-service-select',
        type: 'PRODUCT'
      },
      {
        name: 'attention-today-desactivated',
        type: 'PRODUCT'
      },
      {
        name: 'booking-transfer-queue',
        type: 'PRODUCT'
      },
      {
        name: 'attention-user-search',
        type: 'USER'
      },
      {
        name: 'booking-edit',
        type: 'PRODUCT'
      }
    ];
    return options.sort((a, b) => a.type < b.type ? -1 : 1);
  }
  public async createFeatureToggle(user: string, name: string, commerceId: string, type: string): Promise<FeatureToggle> {
    const existingFeature = await this.getFeatureToggleByNameAndCommerceId(commerceId, name);
    if (existingFeature !== undefined) {
      throw new HttpException('feature-toggle ya existe para este comercio', HttpStatus.FOUND);
    }
    let feature = new FeatureToggle();
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
  public async updateFeatureToggle(user: string, id: string, active: boolean): Promise<FeatureToggle> {
    let commerce = await this.getFeatureToggleById(id);
    if (active !== undefined) {
      commerce.active = active;
    }
    return await this.update(user, commerce);
  }
}
