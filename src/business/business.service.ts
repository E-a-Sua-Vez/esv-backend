import { forwardRef, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { NotificationClient } from 'src/notification/infrastructure/notification-client';
import { clientStrategy } from 'src/notification/infrastructure/notification-client-strategy';
import { NotificationChannel } from 'src/notification/model/notification-channel.enum';

import { CommerceService } from '../commerce/commerce.service';

import { BusinessKeyNameDetailsDto } from './dto/business-keyname-details.dto';
import BusinessCreated from './events/BusinessCreated';
import BusinessUpdated from './events/BusinessUpdated';
import BusinessWhatsappConnectionCreated from './events/BusinessWhatsappConnectionCreated';
import BusinessWhatsappConnectionDisconnected from './events/BusinessWhatsappConnectionDisconnected';
import BusinessWhatsappConnectionRequested from './events/BusinessWhatsappConnectionRequested';
import {
  Business,
  ContactInfo,
  LocaleInfo,
  ServiceInfo,
  WhatsappConnection,
} from './model/business.entity';
import { Category } from './model/category.enum';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepository = getRepository(Business),
    private commerceService: CommerceService,
    @Inject(forwardRef(() => clientStrategy(NotificationChannel.WHATSAPP)))
    private whatsappNotificationClient: NotificationClient
  ) {}

  public async getBusinessById(id: string): Promise<Business> {
    const business = await this.businessRepository.findById(id);
    let businessAux = undefined;
    if (business) {
      businessAux = business;
    }
    if (businessAux) {
      businessAux.commerces = await this.commerceService.getActiveCommercesByBusinessId(id);
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

  public async getBusinessByKeyName(keyName: string): Promise<BusinessKeyNameDetailsDto> {
    const businessKeyNameDetailsDto: BusinessKeyNameDetailsDto = new BusinessKeyNameDetailsDto();
    const business = await this.businessRepository.whereEqualTo('keyName', keyName).find();
    let businessAux = undefined;
    if (business && business.length > 0) {
      businessAux = business[0];
    }
    if (businessAux) {
      businessAux.commerces = await this.commerceService.getActiveCommercesByBusinessKeyName(
        businessAux.id
      );
    }
    businessKeyNameDetailsDto.id = businessAux.id;
    businessKeyNameDetailsDto.name = businessAux.name;
    businessKeyNameDetailsDto.keyName = businessAux.keyName;
    businessKeyNameDetailsDto.logo = businessAux.logo;
    businessKeyNameDetailsDto.active = businessAux.active;
    businessKeyNameDetailsDto.available = businessAux.available;
    businessKeyNameDetailsDto.category = businessAux.category;
    businessKeyNameDetailsDto.commerces = businessAux.commerces;
    return businessKeyNameDetailsDto;
  }

  public async createBusiness(
    user: string,
    name: string,
    keyName: string,
    country: string,
    email: string,
    logo: string,
    phone: string,
    url: string,
    category: Category,
    localeInfo: LocaleInfo,
    contactInfo: ContactInfo,
    serviceInfo: ServiceInfo,
    partnerId: string
  ): Promise<Business> {
    const business = new Business();
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
    const businessUpdatedEvent = new BusinessUpdated(new Date(), businessUpdated, { user });
    publish(businessUpdatedEvent);
    return businessUpdated;
  }

  public async updateBusiness(
    user: string,
    id: string,
    logo: string,
    phone: string,
    url: string,
    active: boolean,
    category: Category,
    localeInfo: LocaleInfo,
    contactInfo: ContactInfo,
    serviceInfo: ServiceInfo,
    partnerId: string
  ): Promise<Business> {
    const business = await this.getBusiness(id);
    if (logo) {
      business.logo = logo;
    }
    if (url) {
      url;
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
    const commerces = await this.commerceService.getActiveCommercesByBusinessId(businessId);
    if (commerces && commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        const commerce = commerces[i];
        await this.commerceService.desactivateCommerce(user, commerce.id);
      }
    }
    business.active = false;
    await this.update(user, business);
  }

  public async activateBusiness(
    user: string,
    businessId: string,
    planId: string,
    planActivationId: string
  ): Promise<void> {
    const business = await this.getBusiness(businessId);
    if (!business) {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
    const commerces = await this.commerceService.getActiveCommercesByBusinessId(businessId);
    if (commerces && commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        const commerce = commerces[i];
        await this.commerceService.activateCommerce(user, commerce.id);
      }
    }
    business.active = true;
    business.planId = planId;
    business.currentPlanActivationId = planActivationId;
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

  public async getWhatsappConnectionById(id: string): Promise<WhatsappConnection> {
    const business = await this.businessRepository.findById(id);
    if (business && business.id) {
      if (business.whatsappConnection) {
        return business.whatsappConnection;
      }
    }
  }

  public async updateWhatsappConnection(
    user: string,
    id: string,
    idConnection: string,
    whatsapp: string,
    connected?: boolean
  ): Promise<Business> {
    const business = await this.businessRepository.findById(id);
    if (business && business.id) {
      if (!business.whatsappConnection) {
        const whatsappConnection = {
          createdAt: new Date(),
          lastConection: new Date(),
          whatsapp: whatsapp,
        };
        business.whatsappConnection = whatsappConnection;
      } else {
        business.whatsappConnection.lastConection = new Date();
        business.whatsappConnection.whatsapp = whatsapp;
      }
      if (idConnection !== undefined) {
        business.whatsappConnection.idConnection = idConnection;
        business.whatsappConnection.connected = true;
      } else {
        business.whatsappConnection.connected = false;
      }
      if (connected !== undefined) {
        business.whatsappConnection.connected = connected;
      }
      const businessUpdated = await this.update(user, business);
      if (businessUpdated.whatsappConnection) {
        await this.commerceService.updateWhatsappConnectionCommerce(
          user,
          business.id,
          businessUpdated.whatsappConnection
        );
      }
      return businessUpdated;
    }
  }

  public async requestWhatsappConnectionById(
    user: string,
    id: string,
    whatsapp: string
  ): Promise<any> {
    const business = await this.businessRepository.findById(id);
    if (business && business.id) {
      try {
        if (business.whatsappConnection && business.whatsappConnection.lastConection) {
          const days =
            Math.abs(new Date().getTime() - business.whatsappConnection.lastConection.getTime()) /
            (1000 * 60 * 60 * 24);
          if (days >= 1) {
            throw new HttpException(
              'Limite de peticiones alcanzado',
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
        }
        const connection = await this.whatsappNotificationClient.requestConnection();
        if (connection && connection['result'] === 'success') {
          const eventData = {
            businessId: id,
            result: connection['result'],
            instance: connection['w_instancia_id'],
            createdAt: new Date(),
            user,
          };
          await this.updateWhatsappConnection(
            user,
            id,
            connection['w_instancia_id'],
            whatsapp,
            false
          );
          const businessWhatsappConnectionRequestedEvent = new BusinessWhatsappConnectionRequested(
            new Date(),
            eventData,
            { user }
          );
          publish(businessWhatsappConnectionRequestedEvent);
          return connection;
        }
      } catch (error) {
        throw new HttpException(
          `No fue posible solicitar conexion whatsapp: ${error.message}`,
          HttpStatus.FAILED_DEPENDENCY
        );
      }
    } else {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
  }

  public async returnWhatsappConnectionById(
    user: string,
    id: string,
    instanceId: number
  ): Promise<any> {
    const business = await this.businessRepository.findById(id);
    if (business && business.id) {
      try {
        const events = await this.whatsappNotificationClient.requestEvent();
        if (events && events['result'] === 'success' && events['data']) {
          if (events['data'] && events['data'].length > 0) {
            let event;
            events['data'].forEach(evt => {
              const payload = JSON.parse(evt.payload);
              if (
                payload['event'].toString() === 'qrcode' &&
                payload['w_instancia_id'].toString() === instanceId.toString()
              ) {
                event = evt;
                event.payload = payload;
              }
            });
            if (event) {
              const eventData = {
                businessId: id,
                resultId: event['id'],
                result: events['result'],
                instance: event['payload']['w_instancia_id'],
                createdAt: new Date(),
                user,
              };
              const businessWhatsappConnectionRequestedEvent =
                new BusinessWhatsappConnectionCreated(new Date(), eventData, { user });
              publish(businessWhatsappConnectionRequestedEvent);
              return event;
            }
          }
        }
      } catch (error) {
        throw new HttpException(
          `No fue posible solicitar conexion whatsapp: ${error.message}`,
          HttpStatus.FAILED_DEPENDENCY
        );
      }
    } else {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
  }

  public async disconnectedWhatsappConnectionById(
    user: string,
    id: string,
    instanceId: string
  ): Promise<any> {
    const business = await this.businessRepository.findById(id);
    if (business && business.id) {
      try {
        if (business.whatsappConnection && business.whatsappConnection.connected) {
          const connection = await this.whatsappNotificationClient.disconnectService(instanceId);
          if (connection && connection['result'] === 'success') {
            const eventData = {
              businessId: id,
              result: connection['result'],
              instance: connection['w_instancia_id'],
              createdAt: new Date(),
              user,
            };
            await this.updateWhatsappConnection(
              user,
              id,
              connection['w_instancia_id'],
              business.whatsappConnection.whatsapp,
              false
            );
            const businessWhatsappConnectionDisconnectedEvent =
              new BusinessWhatsappConnectionDisconnected(new Date(), eventData, { user });
            publish(businessWhatsappConnectionDisconnectedEvent);
            return connection;
          }
        } else {
          throw new HttpException(`Whatsapp ya fue desconectado`, HttpStatus.BAD_REQUEST);
        }
      } catch (error) {
        throw new HttpException(
          `No fue posible solicitar conexion whatsapp: ${error.message}`,
          HttpStatus.FAILED_DEPENDENCY
        );
      }
    } else {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
  }

  public async statusWhatsappConnectionById(user: string, id: string): Promise<WhatsappConnection> {
    const business = await this.businessRepository.findById(id);
    if (business && business.id) {
      try {
        if (business.whatsappConnection && business.whatsappConnection.whatsapp) {
          const connection = await this.whatsappNotificationClient.requestServiceStatus(
            business.whatsappConnection.whatsapp
          );
          if (connection && connection['result'] && connection['result'] === 'success') {
            let businessUpdated;
            if (connection['phone_state'] && connection['phone_state'] === 'connected') {
              businessUpdated = await this.updateWhatsappConnection(
                user,
                id,
                connection['w_instancia_id'],
                business.whatsappConnection.whatsapp,
                true
              );
            } else {
              businessUpdated = await this.updateWhatsappConnection(
                user,
                id,
                undefined,
                business.whatsappConnection.whatsapp,
                false
              );
            }
            return businessUpdated.whatsappConnection;
          } else {
            // If the response doesn't indicate success, update connection to disconnected
            const businessUpdated = await this.updateWhatsappConnection(
              user,
              id,
              undefined,
              business.whatsappConnection.whatsapp,
              false
            );
            return businessUpdated.whatsappConnection;
          }
        } else {
          throw new HttpException(`No se encontró conexion Whatsapp`, HttpStatus.NOT_FOUND);
        }
      } catch (error) {
        // Check if it's a 404 error (instance not found in gateway)
        const errorMessage =
          error.message ||
          (error.response && error.response.data && error.response.data.message) ||
          String(error);
        const is404 =
          (error.response && error.response.status === 404) ||
          (errorMessage &&
            (errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found')));

        if (is404) {
          // Update the connection status to disconnected since instance doesn't exist
          try {
            const businessUpdated = await this.updateWhatsappConnection(
              user,
              id,
              undefined,
              business.whatsappConnection?.whatsapp,
              false
            );
            return businessUpdated.whatsappConnection;
          } catch (updateError) {
            throw new HttpException(
              `La instancia de WhatsApp no existe en el gateway. No se pudo actualizar el estado: ${updateError.message}`,
              HttpStatus.NOT_FOUND
            );
          }
        }
        throw new HttpException(
          `No fue posible ver status conexion whatsapp: ${errorMessage}`,
          HttpStatus.FAILED_DEPENDENCY
        );
      }
    } else {
      throw new HttpException(`Business no existe`, HttpStatus.BAD_REQUEST);
    }
  }
}
