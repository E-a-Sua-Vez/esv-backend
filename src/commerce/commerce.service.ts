import { Commerce, ContactInfo, LocaleInfo, ServiceInfo } from './model/commerce.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { QueueService } from 'src/queue/queue.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import CommerceUpdated from './events/CommerceUpdated';
import { Country } from 'src/shared/model/country.enum';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { Category } from './model/category.enum';
import { SurveyPersonalizedService } from '../survey-personalized/survey-personalized.service';
import { NotificationService } from 'src/notification/notification.service';
import { QueryStackClient } from './infrastructure/query-stack-client';
import { NotificationType } from 'src/notification/model/notification-type.enum';
import { NotificationTemplate } from '../notification/model/notification-template.enum';
import { FeatureToggleName } from 'src/feature-toggle/model/feature-toggle.enum';
import { FeatureToggle } from 'src/feature-toggle/model/feature-toggle.entity';
import CommerceCreated from './events/CommerceCreated';
import { CollaboratorService } from '../collaborator/collaborator.service';
import { ServiceService } from '../service/service.service';

@Injectable()
export class CommerceService {
  constructor(
    @InjectRepository(Commerce)
    private commerceRepository = getRepository(Commerce),
    private queueService: QueueService,
    private featureToggleService: FeatureToggleService,
    private surveyPersonalizedService: SurveyPersonalizedService,
    private notificationService: NotificationService,
    private queryStackClient: QueryStackClient
  ) {}

  public async getCommerceById(id: string): Promise<Commerce> {
    let commerce = await this.commerceRepository.findById(id);
    let commerceAux = commerce;
    commerceAux.queues = await this.queueService.getActiveQueuesByCommerce(id);
    commerceAux.surveys = await this.surveyPersonalizedService.getSurveysPersonalizedByCommerceId(id);
    commerceAux.features = await this.featureToggleService.getFeatureToggleByCommerceId(commerceAux.id);
    return commerceAux;
  }

  public async getCommerceDetails(id: string): Promise<Commerce> {
    let commerce = await this.commerceRepository.findById(id);
    let commerceAux = commerce;
    commerceAux.queues = await this.queueService.getActiveQueuesByCommerce(id);
    commerceAux.surveys = await this.surveyPersonalizedService.getSurveysPersonalizedByCommerceId(id);
    commerceAux.features = await this.featureToggleService.getFeatureToggleByCommerceId(id);
    return commerceAux;
  }

  public async getCommerce(id: string): Promise<Commerce> {
    return await this.commerceRepository.findById(id);
  }

  public async getCommerces(): Promise<Commerce[]> {
    const commerces = await this.commerceRepository.find();
    return commerces;
  }

  public async getCommerceByKeyName(keyName: string): Promise<Commerce> {
    let commerces = await this.commerceRepository.whereEqualTo('keyName', keyName).find();
    if (commerces.length > 0) {
      let commerceAux = commerces[0];
      commerceAux.queues = await this.queueService.getActiveQueuesByCommerce(commerceAux.id);
      commerceAux.features = await this.featureToggleService.getFeatureToggleByCommerceId(commerceAux.id);
      return commerceAux;
    }
  }

  public async getCommercesByBusinessId(businessId: string): Promise<Commerce[]> {
    let commercesToReturn = [];
    const commerces = await this.commerceRepository
      .whereEqualTo('businessId', businessId)
      .orderByAscending('tag')
      .find();
    if (commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        let commerceAux = commerces[i];
        commerceAux.features = await this.featureToggleService.getFeatureToggleByCommerceId(commerceAux.id);
        commercesToReturn.push(commerceAux);
      }
    }
    return commercesToReturn;
  }

  public async getActiveCommercesByBusinessId(businessId: string): Promise<Commerce[]> {
    const commerces = await this.commerceRepository
      .whereEqualTo('businessId', businessId)
      .whereEqualTo('active', true)
      .orderByAscending('tag')
      .find();
    return commerces;
  }

  public async createCommerce(user: string, name: string, keyName: string, tag: string, businessId: string, country: Country, email: string, logo: string, phone: string, url: string, localeInfo: LocaleInfo, contactInfo: ContactInfo, serviceInfo: ServiceInfo, category: Category): Promise<Commerce> {
    let commerce = new Commerce();
    commerce.businessId = businessId;
    commerce.name = name;
    commerce.keyName = keyName;
    commerce.tag = tag;
    commerce.email = email;
    commerce.logo = logo;
    commerce.active = true;
    commerce.phone = phone;
    commerce.category = category;
    commerce.createdAt = new Date();
    if (localeInfo !== undefined) {
      commerce.localeInfo = localeInfo;
      if (commerce.localeInfo.country) {
        commerce.country = country;
      }
    }
    if (contactInfo !== undefined) {
      commerce.contactInfo = contactInfo;
    }
    if (serviceInfo !== undefined) {
      commerce.serviceInfo = serviceInfo;
    }
    commerce.url = url;
    const commerceCreated = await this.commerceRepository.create(commerce);
    const commerceCreatedEvent = new CommerceCreated(new Date(), commerceCreated, { user });
    publish(commerceCreatedEvent);
    return commerceCreated;
  }

  public async update(user: string, commerce: Commerce): Promise<Commerce> {
    const commerceUpdated = await this.commerceRepository.update(commerce);
    const collaboratorUpdatedEvent = new CommerceUpdated(new Date(), commerceUpdated, { user });
    publish(collaboratorUpdatedEvent);
    return commerceUpdated;
  }

  public async updateCommerce(user: string, id: string, tag: string, logo: string, phone: string, url: string, active: boolean, localeInfo: LocaleInfo, contactInfo: ContactInfo, serviceInfo: ServiceInfo, category: Category): Promise<Commerce> {
    let commerce = await this.getCommerce(id);
    if (tag) {
      commerce.tag = tag;
    }
    if (logo) {
      commerce.logo = logo;
    }
    if (url) {url
      commerce.url = url;
    }
    if (phone) {
      commerce.phone = phone;
    }
    if (category) {
      commerce.category = category;
    }
    if (active !== undefined) {
      commerce.active = active;
    }
    if (localeInfo !== undefined) {
      commerce.localeInfo = localeInfo;
    }
    if (contactInfo !== undefined) {
      commerce.contactInfo = contactInfo;
    }
    if (serviceInfo !== undefined) {
      commerce.serviceInfo = serviceInfo;
    }
    return await this.update(user, commerce);
  }

  public async activateCommerce(user: string, commerceId: string): Promise<void> {
    const commerce = await this.getCommerce(commerceId);
    if (!commerceId) {
      throw new HttpException(`Commerce no existe`, HttpStatus.BAD_REQUEST);
    }
    commerce.active = true;
    await this.update(user, commerce);
  }

  public async desactivateCommerce(user: string, commerceId: string): Promise<void> {
    const commerce = await this.getCommerce(commerceId);
    if (!commerceId) {
      throw new HttpException(`Commerce no existe`, HttpStatus.BAD_REQUEST);
    }
    commerce.active = false;
    await this.update(user, commerce);
  }

  featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  public async notifyCommerceStatistics(): Promise<any> {
    const commerces = await this.getCommerces();
    const from = new Date(new Date(new Date().setMonth(new Date().getMonth() - 1)).setDate(0)).toISOString().slice(0, 10);
    const pastFromDate = new Date(new Date(new Date().setMonth(new Date().getMonth() - 1)).setDate(0));
    const to = new Date(pastFromDate.getFullYear(), pastFromDate.getMonth() + 2, 0).toISOString().slice(0, 10);
    if (commerces.length > 0) {
      for(let i = 0; i < commerces.length; i++) {
        const commerce = commerces[i];
        const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(commerce.id, FeatureToggleName.EMAIL);
        let notify = this.featureToggleIsActive(featureToggle, 'email-monthly-commerce-statistics');
        const template = `${NotificationTemplate.MONTHLY_COMMERCE_STATISTICS}-${commerce.localeInfo.language || 'es'}`;
        if (commerce.email && notify === true) {
          const { calculatedMetrics } =  await this.queryStackClient.getMetrics({ commerceId: commerce.id, from, to});
          await this.notificationService.createAttentionStatisticsEmailNotification(
            commerce.email,
            NotificationType.MONTHLY_COMMERCE_STATISTICS,
            commerce.id,
            template,
            commerce.name,
            commerce.tag,
            from,
            to,
            calculatedMetrics['attention.created'].attentionNumber || 0,
            calculatedMetrics['attention.created'].pastMonthAttentionNumber.number || 0,
            parseFloat(calculatedMetrics['attention.created'].avgDuration).toFixed(2) || 0,
            parseFloat(calculatedMetrics['attention.created'].avgDuration).toFixed(2) || 0,
            parseFloat(calculatedMetrics['attention.created'].dailyAvg).toFixed(2) || 0,
            parseFloat(calculatedMetrics['attention.created'].pastMonthAttentionNumber.dailyAvg).toFixed(2) || 0,
            parseFloat(calculatedMetrics['survey.created'].avgRating).toFixed(2) || 0,
            parseFloat(calculatedMetrics['survey.created'].avgRating).toFixed(2) || 0
          );
        }
      }
    }


  }
}
