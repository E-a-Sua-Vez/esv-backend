import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import PartnerCreated from './events/PartnerCreated';
import PartnerUpdated from './events/PartnerUpdated';
import { Partner } from './partner.entity';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(Partner)
    private partnerRepository = getRepository(Partner)
  ) {}

  public async getPartnerById(id: string): Promise<Partner> {
    const partner = await this.partnerRepository.findById(id);
    return partner;
  }

  public async getPartners(): Promise<Partner[]> {
    const partners = await this.partnerRepository.find();
    return partners;
  }

  public async getPartnerByEmail(email: string): Promise<Partner> {
    const partners = await this.partnerRepository.whereEqualTo('email', email).find();
    const partner = partners[0];
    return partner;
  }

  public async update(partner: Partner): Promise<Partner> {
    const partnerUpdated = await this.partnerRepository.update(partner);
    const partnerUpdatedEvent = new PartnerUpdated(new Date(), partnerUpdated);
    publish(partnerUpdatedEvent);
    return partnerUpdated;
  }

  public async updatePartner(
    id: string,
    phone: string,
    active: boolean,
    alias: string,
    businessIds: string[]
  ): Promise<Partner> {
    const partner = await this.getPartnerById(id);
    if (phone) {
      partner.phone = phone;
    }
    if (active !== undefined) {
      partner.active = active;
    }
    if (alias) {
      partner.alias = alias;
    }
    if (businessIds !== undefined) {
      partner.businessIds = businessIds;
    }
    return await this.update(partner);
  }

  public async updateToken(id: string, token: string): Promise<Partner> {
    const partner = await this.getPartnerById(id);
    partner.token = token;
    partner.lastSignIn = new Date();
    return await this.update(partner);
  }

  public async createPartner(
    name: string,
    email: string,
    phone: string,
    businessIds: string[],
    alias: string
  ): Promise<Partner> {
    try {
      const partner = new Partner();
      partner.name = name;
      partner.email = email;
      partner.phone = phone;
      partner.businessIds = businessIds;
      partner.active = true;
      partner.alias = alias || name;
      const partnerCreated = await this.partnerRepository.create(partner);
      const partnerCreatedEvent = new PartnerCreated(new Date(), partnerCreated);
      publish(partnerCreatedEvent);
      return partnerCreated;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al crear el partner: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async changeStatus(id: string, action: boolean): Promise<Partner> {
    try {
      const partner = await this.partnerRepository.findById(id);
      partner.active = action;
      return await this.update(partner);
    } catch (error) {
      throw `Hubo un problema al activar o desactivar el partner: ${error.message}`;
    }
  }

  public async changePassword(id: string): Promise<Partner> {
    let partner = await this.partnerRepository.findById(id);
    if (partner) {
      if (!partner.firstPasswordChanged) {
        partner.firstPasswordChanged = true;
      }
      const days =
        Math.abs(new Date().getTime() - partner.lastPasswordChanged.getTime()) /
        (1000 * 60 * 60 * 24);
      if (days < 1) {
        throw new HttpException(
          'Limite de cambio de password alcanzado',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      partner.lastPasswordChanged = new Date();
      partner = await this.update(partner);
      return partner;
    } else {
      throw new HttpException('partner no existe', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
