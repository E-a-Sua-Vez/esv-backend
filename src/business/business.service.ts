import { Business, ContactInfo, LocaleInfo, ServiceInfo } from './model/business.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CommerceService } from '../commerce/commerce.service';
import { publish } from 'ett-events-lib';
import BusinessCreated from './events/BusinessCreated';
import BusinessUpdated from './events/BusinessUpdated';
import { Category } from './model/category.enum';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepository = getRepository(Business),
    private commerceService: CommerceService
  ) {}

  public async getBusinessById(id: string): Promise<Business> {
    let business = await this.businessRepository.findById(id);
    let businessAux = undefined;
    if (business) {
      businessAux = business;
    }
    if (businessAux) {
      businessAux.commerces = await this.commerceService.getCommercesByBusinessId(id);
    }
    return businessAux;
  }

  public async getBusiness(id: string): Promise<Business> {
    return await this.businessRepository.findById(id);
  }

  public async getBusinesses(): Promise<Business[]> {
    const businesses = await this.businessRepository.find();
    return businesses;
  }

  public async getBusinessByKeyName(keyName: string): Promise<Business> {
    let business = await this.businessRepository.whereEqualTo('keyName', keyName).find();
    let businessAux = undefined;
    if (business && business.length > 0) {
      businessAux = business[0];
    }
    if (businessAux) {
      businessAux.commerces = await this.commerceService.getCommercesByBusinessId(businessAux.id);
    }
    return businessAux;
  }

  public async createBusiness(user: string, name: string, keyName: string, country: string, email: string, logo: string, phone: string, url: string, category: Category, localeInfo: LocaleInfo, contactInfo: ContactInfo, serviceInfo: ServiceInfo, partnerId: string): Promise<Business> {
    let business = new Business();
    business.name = name;
    business.keyName = keyName;
    business.email = email;
    business.logo = logo;
    business.active = true;
    business.category = category;
    business.createdAt = new Date();
    business.partnerId = partnerId;
    if (localeInfo !== undefined) {
      business.localeInfo = localeInfo;
      if (localeInfo.country && !country) {
        business.country = localeInfo.country;
      } else {
        business.country = country;
      }
    } else {
      business.localeInfo = {} as LocaleInfo;
    }
    if (contactInfo !== undefined) {
      business.contactInfo = contactInfo;
      if (contactInfo.phone && !phone) {
        business.phone = contactInfo.phone;
      } else {
        business.phone = phone;
      }
      if (!url) {
        business.url = '';
      } else {
        business.url = url;
      }
    } else {
      business.contactInfo = {} as ContactInfo;
    }
    if (serviceInfo !== undefined) {
      business.serviceInfo = serviceInfo;
    } else {
      business.serviceInfo = {} as ServiceInfo;
    }
    business.logo = '/images/logo_horizontal_blanco.png';
    if (logo) {
      business.logo = logo;
    }
    const businessCreated = await this.businessRepository.create(business);
    const businessCreatedEvent = new BusinessCreated(new Date(), businessCreated, { user });
    publish(businessCreatedEvent);
    return businessCreated;
  }

  public async update(user: string, business: Business): Promise<Business> {
    const businessUpdated = await this.businessRepository.update(business);
    const businessUpdatedEvent = new BusinessUpdated(new Date(), businessUpdated,{ user });
    publish(businessUpdatedEvent);
    return businessUpdated;
  }

  public async updateBusiness(user: string, id: string, logo: string, phone: string, url: string, active: boolean, category: Category, localeInfo: LocaleInfo, contactInfo: ContactInfo, serviceInfo: ServiceInfo, partnerId: string): Promise<Business> {
    let business = await this.getBusiness(id);
    if (logo) {
      business.logo = logo;
    }
    if (url) {url
      business.url = url;
    }
    if (phone) {
      business.phone = phone;
    }
    if (category) {
      business.category = category;
    }
    if (active !== undefined) {
      business.active = active;
    }
    if (localeInfo !== undefined) {
      business.localeInfo = localeInfo;
    }
    if (contactInfo !== undefined) {
      business.contactInfo = contactInfo;
    }
    if (serviceInfo !== undefined) {
      business.serviceInfo = serviceInfo;
    }
    if (partnerId !== undefined) {
      business.partnerId = partnerId;
    }
    return await this.update(user, business);
  }

  public async desactivateBusiness(user: string, businessId: string): Promise<void> {
    const business = await this.getBusiness(businessId);
    if (!business) {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
    const commerces = await this.commerceService.getCommercesByBusinessId(businessId);
    if (commerces && commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        let commerce = commerces[i];
        await this.commerceService.desactivateCommerce(user, commerce.id);
      }
    }
    business.active = false;
    await this.update(user, business);
  }

  public async activateBusiness(user: string, businessId: string, planId: string, planActivationId: string): Promise<void> {
    const business = await this.getBusiness(businessId);
    if (!business) {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
    const commerces = await this.commerceService.getCommercesByBusinessId(businessId);
    if (commerces && commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        let commerce = commerces[i];
        await this.commerceService.activateCommerce(user, commerce.id);
      }
    }
    business.active = true;
    business.planId = planId;
    business .currentPlanActivationId = planActivationId;
    await this.update(user, business);
  }

  public async updateBusinessPlan(user: string, businessId: string, planId: string): Promise<void> {
    const business = await this.getBusinessById(businessId);
    if (!business) {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
    business.planId = planId;
    await this.update(user, business);
  }
}
