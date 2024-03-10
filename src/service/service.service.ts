import { Service, ServiceInfo } from './model/service.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import ServiceCreated from './events/ServiceCreated';
import ServiceUpdated from './events/ServiceUpdated';
import { ServiceType } from './model/service-type.enum';

@Injectable()
export class ServiceService {
  constructor(
  @InjectRepository(Service)
    private serviceRepository = getRepository(Service)
  ) {}

  public async getServiceById(id: string): Promise<Service> {
    let service = await this.serviceRepository.findById(id);
    return service;
  }

  public async getServices(): Promise<Service[]> {
    let services: Service[] = [];
    services = await this.serviceRepository.find();
    return services;
  }

  public async getServiceByCommerce(commerceId: string): Promise<Service[]> {
    let services: Service[] = [];
    services = await this.serviceRepository
      .whereEqualTo('commerceId', commerceId)
      .orderByAscending('order')
      .whereEqualTo('available', true)
      .find();
    return services;
  }

  public async getActiveServicesByCommerce(commerceId: string): Promise<Service[]> {
    let services: Service[] = [];
    services = await this.serviceRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .orderByAscending('order')
      .find();
    return services;
  }

  public async getOnlineServicesByCommerce(commerceId: string): Promise<Service[]> {
    let services: Service[] = [];
    services = await this.serviceRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('online', true)
      .orderByAscending('order')
      .find();
    return services;
  }

  public async updateServiceConfigurations(user: string, id: string, name: string, tag: string, order: number, active: boolean, available: boolean, online: boolean, serviceInfo: ServiceInfo): Promise<Service> {
    try {
      let service = await this.serviceRepository.findById(id);
      if (name) {
        service.name = name;
      }
      if (tag) {
        service.tag = tag;
      }
      if (order) {
        service.order = order;
      }
      if (active !== undefined) {
        service.active = active;
      }
      if (available !== undefined) {
        service.available = available;
      }
      if (online !== undefined) {
        service.online = online;
      }
      if (serviceInfo !== undefined) {
        service.serviceInfo = serviceInfo;
      }
      return await this.updateService(user, service);
    } catch (error) {
      throw new HttpException(`Hubo un problema al modificar el servicio: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async updateService(user: string, service: Service): Promise<Service> {
    const serviceUpdated = await await this.serviceRepository.update(service);
    const serviceUpdatedEvent = new ServiceUpdated(new Date(), serviceUpdated, { user });
    publish(serviceUpdatedEvent);
    return serviceUpdated;
  }

  public async createService(user: string, commerceId: string, name: string, type: ServiceType, tag: string, online: boolean, order: number, serviceInfo: ServiceInfo): Promise<Service> {
    let service = new Service();
    service.commerceId = commerceId;
    service.name = name;
    service.type = type || ServiceType.STANDARD;
    service.tag = tag;
    service.online = online;
    service.active = true;
    service.available = true;
    service.createdAt = new Date();
    service.order = order;
    service.serviceInfo = serviceInfo;
    const serviceCreated = await this.serviceRepository.create(service);
    const serviceCreatedEvent = new ServiceCreated(new Date(), serviceCreated, { user });
    publish(serviceCreatedEvent);
    return serviceCreated;
  }
}
