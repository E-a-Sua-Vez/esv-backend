import { HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { FeatureToggle } from 'src/feature-toggle/model/feature-toggle.entity';
import { FeatureToggleName } from 'src/feature-toggle/model/feature-toggle.enum';
import { NotificationType } from 'src/notification/model/notification-type.enum';
import { NotificationService } from 'src/notification/notification.service';
import { QueueService } from 'src/queue/queue.service';
import { Country } from 'src/shared/model/country.enum';

import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { NotificationTemplate } from '../notification/model/notification-template.enum';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';
import { SurveyPersonalizedService } from '../survey-personalized/survey-personalized.service';

import { CommerceKeyNameDetailsDto } from './dto/commerce-keyname-details.dto';
import CommerceCreated from './events/CommerceCreated';
import CommerceUpdated from './events/CommerceUpdated';
import { QueryStackClient } from './infrastructure/query-stack-client';
import { Category } from './model/category.enum';
import {
  Commerce,
  ContactInfo,
  LocaleInfo,
  ServiceInfo,
  WhatsappConnection,
} from './model/commerce.entity';

@Injectable()
export class CommerceService {
  constructor(
    @InjectRepository(Commerce)
    private commerceRepository = getRepository(Commerce),
    private queueService: QueueService,
    private featureToggleService: FeatureToggleService,
    private surveyPersonalizedService: SurveyPersonalizedService,
    private notificationService: NotificationService,
    private queryStackClient: QueryStackClient,
    @Inject(GcpLoggerService)
    private readonly logger: GcpLoggerService
  ) {
    this.logger.setContext('CommerceService');
  }

  public async getCommerceById(id: string): Promise<Commerce> {
    const commerce = await this.commerceRepository.findById(id);
    const [queues, surveys, features] = await Promise.all([
      this.queueService.getActiveQueuesByCommerce(id),
      this.surveyPersonalizedService.getSurveysPersonalizedByCommerceId(id),
      this.featureToggleService.getFeatureToggleByCommerceId(id),
    ]);
    const commerceAux = commerce;
    if (queues && queues.length > 0) {
      commerceAux.queues = queues;
    }
    if (surveys && surveys.length > 0) {
      commerceAux.surveys = surveys;
    }
    if (features && features.length > 0) {
      commerceAux.features = features;
    }
    return commerceAux;
  }

  public async getCommerceDetails(id: string): Promise<CommerceKeyNameDetailsDto> {
    const commerceKeyNameDetailsDto: CommerceKeyNameDetailsDto = new CommerceKeyNameDetailsDto();
    const commerce = await this.commerceRepository.findById(id);
    const [queues, surveys, features] = await Promise.all([
      this.queueService.getActiveQueuesByCommerce(id),
      this.surveyPersonalizedService.getSurveysPersonalizedByCommerceId(id),
      this.featureToggleService.getFeatureToggleDetailsByCommerceId(id),
    ]);
    commerceKeyNameDetailsDto.id = commerce.id;
    commerceKeyNameDetailsDto.name = commerce.name;
    commerceKeyNameDetailsDto.keyName = commerce.keyName;
    commerceKeyNameDetailsDto.logo = commerce.logo;
    commerceKeyNameDetailsDto.active = commerce.active;
    commerceKeyNameDetailsDto.available = commerce.available;
    commerceKeyNameDetailsDto.localeInfo = commerce.localeInfo;
    commerceKeyNameDetailsDto.serviceInfo = commerce.serviceInfo;
    commerceKeyNameDetailsDto.queues = queues;
    commerceKeyNameDetailsDto.features = features;
    commerceKeyNameDetailsDto.surveys = surveys;
    return commerceKeyNameDetailsDto;
  }

  public async getCommerce(id: string): Promise<Commerce> {
    return await this.commerceRepository.findById(id);
  }

  public async getCommerces(): Promise<Commerce[]> {
    const commerces = await this.commerceRepository.find();
    return commerces;
  }

  public async getCommercesDetails(): Promise<Commerce[]> {
    const result: Commerce[] = [];
    const commerces = await this.commerceRepository.find();
    if (commerces && commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        const commerce = commerces[i];
        const [features] = await Promise.all([
          this.featureToggleService.getFeatureToggleByCommerceId(commerce.id),
        ]);
        const commerceAux = commerce;
        commerceAux.features = features;
        result.push(commerceAux);
      }
    }
    return result;
  }

  public async getCommerceByKeyName(keyName: string): Promise<CommerceKeyNameDetailsDto> {
    const commerceKeyNameDetailsDto: CommerceKeyNameDetailsDto = new CommerceKeyNameDetailsDto();
    const commerces = await this.commerceRepository.whereEqualTo('keyName', keyName).find();
    if (commerces.length > 0) {
      const commerceAux = commerces[0];
      const [features] = await Promise.all([
        this.featureToggleService.getFeatureToggleDetailsByCommerceId(commerceAux.id),
      ]);
      commerceKeyNameDetailsDto.id = commerceAux.id;
      commerceKeyNameDetailsDto.name = commerceAux.name;
      commerceKeyNameDetailsDto.keyName = commerceAux.keyName;
      commerceKeyNameDetailsDto.tag = commerceAux.tag;
      commerceKeyNameDetailsDto.logo = commerceAux.logo;
      commerceKeyNameDetailsDto.active = commerceAux.active;
      commerceKeyNameDetailsDto.category = commerceAux.category;
      commerceKeyNameDetailsDto.available = commerceAux.available;
      commerceKeyNameDetailsDto.localeInfo = commerceAux.localeInfo;
      commerceKeyNameDetailsDto.serviceInfo = commerceAux.serviceInfo;
      commerceKeyNameDetailsDto.contactInfo = commerceAux.contactInfo;
      commerceKeyNameDetailsDto.features = features;
      return commerceKeyNameDetailsDto;
    }
  }

  public async getCommercesByBusinessId(businessId: string): Promise<Commerce[]> {
    const commerces = await this.commerceRepository
      .whereEqualTo('businessId', businessId)
      .whereEqualTo('available', true)
      .orderByAscending('tag')
      .find();
    return commerces;
  }

  public async getActiveCommercesByBusinessId(
    businessId: string
  ): Promise<CommerceKeyNameDetailsDto[]> {
    const commercesToReturn: CommerceKeyNameDetailsDto[] = [];
    const commerces = await this.commerceRepository
      .whereEqualTo('businessId', businessId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('tag')
      .find();
    if (commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        const commerceAux = commerces[i];
        const commerceKeyNameDetailsDto: CommerceKeyNameDetailsDto =
          new CommerceKeyNameDetailsDto();
        commerceAux.features = await this.featureToggleService.getFeatureToggleByCommerceId(
          commerceAux.id
        );
        commerceKeyNameDetailsDto.id = commerceAux.id;
        commerceKeyNameDetailsDto.name = commerceAux.name;
        commerceKeyNameDetailsDto.keyName = commerceAux.keyName;
        commerceKeyNameDetailsDto.tag = commerceAux.tag;
        commerceKeyNameDetailsDto.email = commerceAux.email;
        commerceKeyNameDetailsDto.logo = commerceAux.logo;
        commerceKeyNameDetailsDto.active = commerceAux.active;
        commerceKeyNameDetailsDto.category = commerceAux.category;
        commerceKeyNameDetailsDto.available = commerceAux.available;
        commerceKeyNameDetailsDto.localeInfo = commerceAux.localeInfo;
        commerceKeyNameDetailsDto.serviceInfo = commerceAux.serviceInfo;
        commerceKeyNameDetailsDto.contactInfo = commerceAux.contactInfo;
        commerceKeyNameDetailsDto.features = commerceAux.features;
        commercesToReturn.push(commerceKeyNameDetailsDto);
      }
    }
    return commercesToReturn;
  }

  public async getActiveCommercesByBusinessKeyName(
    businessId: string
  ): Promise<CommerceKeyNameDetailsDto[]> {
    const commercesToReturn: CommerceKeyNameDetailsDto[] = [];
    const commerces = await this.commerceRepository
      .whereEqualTo('businessId', businessId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('tag')
      .find();
    if (commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        const commerceAux = commerces[i];
        const commerceKeyNameDetailsDto: CommerceKeyNameDetailsDto =
          new CommerceKeyNameDetailsDto();
        commerceAux.features = await this.featureToggleService.getFeatureToggleByCommerceId(
          commerceAux.id
        );
        commerceKeyNameDetailsDto.id = commerceAux.id;
        commerceKeyNameDetailsDto.name = commerceAux.name;
        commerceKeyNameDetailsDto.keyName = commerceAux.keyName;
        commerceKeyNameDetailsDto.tag = commerceAux.tag;
        commerceKeyNameDetailsDto.logo = commerceAux.logo;
        commerceKeyNameDetailsDto.active = commerceAux.active;
        commerceKeyNameDetailsDto.category = commerceAux.category;
        commerceKeyNameDetailsDto.available = commerceAux.available;
        commerceKeyNameDetailsDto.localeInfo = commerceAux.localeInfo;
        commerceKeyNameDetailsDto.serviceInfo = commerceAux.serviceInfo;
        commerceKeyNameDetailsDto.contactInfo = commerceAux.contactInfo;
        commerceKeyNameDetailsDto.features = commerceAux.features;
        commercesToReturn.push(commerceKeyNameDetailsDto);
      }
    }
    return commercesToReturn;
  }

  public async createCommerce(
    user: string,
    name: string,
    keyName: string,
    tag: string,
    businessId: string,
    country: Country,
    email: string,
    logo: string,
    phone: string,
    url: string,
    localeInfo: LocaleInfo,
    contactInfo: ContactInfo,
    serviceInfo: ServiceInfo,
    category: Category
  ): Promise<Commerce> {
    const commerce = new Commerce();
    commerce.businessId = businessId;
    commerce.name = name;
    commerce.keyName = keyName;
    commerce.tag = tag;
    commerce.email = email;
    commerce.logo = logo;
    commerce.active = true;
    commerce.available = true;
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
    this.logger.info('Commerce created successfully', {
      commerceId: commerceCreated.id,
      businessId,
      name,
      keyName,
      category,
      country,
      user,
    });
    return commerceCreated;
  }

  public async update(user: string, commerce: Commerce): Promise<Commerce> {
    const commerceUpdated = await this.commerceRepository.update(commerce);
    const collaboratorUpdatedEvent = new CommerceUpdated(new Date(), commerceUpdated, { user });
    publish(collaboratorUpdatedEvent);
    return commerceUpdated;
  }

  public async updateCommerce(
    user: string,
    id: string,
    tag: string,
    logo: string,
    phone: string,
    url: string,
    active: boolean,
    available: boolean,
    localeInfo: LocaleInfo,
    contactInfo: ContactInfo,
    serviceInfo: ServiceInfo,
    category: Category,
    telemedicineRecordingEnabled?: boolean
  ): Promise<Commerce> {
    const commerce = await this.getCommerce(id);
    if (tag) {
      commerce.tag = tag;
    }
    if (logo) {
      commerce.logo = logo;
    }
    if (url) {
      url;
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
    if (available !== undefined) {
      commerce.available = available;
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
    if (telemedicineRecordingEnabled !== undefined) {
      commerce.telemedicineRecordingEnabled = telemedicineRecordingEnabled;
    }
    const updatedCommerce = await this.update(user, commerce);
    this.logger.info('Commerce updated successfully', {
      commerceId: id,
      businessId: commerce.businessId,
      active,
      available,
      hasLocaleInfo: !!localeInfo,
      hasContactInfo: !!contactInfo,
      hasServiceInfo: !!serviceInfo,
      user,
    });
    return updatedCommerce;
  }

  public async updateWhatsappConnectionCommerce(
    user: string,
    businessId: string,
    whatsappConnection: WhatsappConnection
  ): Promise<Commerce[]> {
    const commercesUpdated = [];
    const commerces = await this.getCommercesByBusinessId(businessId);
    if (commerces && commerces.length > 0 && whatsappConnection) {
      for (let i = 0; i < commerces.length; i++) {
        const commerce = commerces[i];
        if (commerce && commerce.id) {
          commerce.whatsappConnection = whatsappConnection;
          await this.update(user, commerce);
          commercesUpdated.push(commerce);
        }
      }
    }
    return commercesUpdated;
  }

  public async getWhatsappConnectionCommerce(id: string): Promise<WhatsappConnection> {
    const commerce = await this.getCommerce(id);
    if (
      commerce.whatsappConnection &&
      commerce.whatsappConnection.connected === true &&
      commerce.whatsappConnection.whatsapp
    ) {
      commerce.whatsappConnection = commerce.whatsappConnection;
      return commerce.whatsappConnection;
    }
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
    const from = new Date(new Date(new Date().setMonth(new Date().getMonth() - 1)).setDate(0))
      .toISOString()
      .slice(0, 10);
    const pastFromDate = new Date(
      new Date(new Date().setMonth(new Date().getMonth() - 1)).setDate(0)
    );
    const to = new Date(pastFromDate.getFullYear(), pastFromDate.getMonth() + 2, 0)
      .toISOString()
      .slice(0, 10);
    if (commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        const commerce = commerces[i];
        const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
          commerce.id,
          FeatureToggleName.EMAIL
        );
        const notify = this.featureToggleIsActive(
          featureToggle,
          'email-monthly-commerce-statistics'
        );
        const template = `${NotificationTemplate.MONTHLY_COMMERCE_STATISTICS}-${
          commerce.localeInfo.language || 'es'
        }`;
        if (commerce.email && notify === true) {
          const { calculatedMetrics } = await this.queryStackClient.getMetrics({
            commerceId: commerce.id,
            from,
            to,
          });
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
            parseFloat(
              calculatedMetrics['attention.created'].pastMonthAttentionNumber.dailyAvg
            ).toFixed(2) || 0,
            parseFloat(calculatedMetrics['survey.created'].avgRating).toFixed(2) || 0,
            parseFloat(calculatedMetrics['survey.created'].avgRating).toFixed(2) || 0
          );
        }
      }
    }
  }
}
