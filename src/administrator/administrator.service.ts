import { HttpException, HttpStatus } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { PermissionService } from '../permission/permission.service';

import AdministratorCreated from './events/AdministratorCreated';
import AdministratorUpdated from './events/AdministratorUpdated';
import { Administrator } from './model/administrator.entity';

export class AdministratorService {
  constructor(
    @InjectRepository(Administrator)
    private administratorRepository = getRepository(Administrator),
    private permissionService: PermissionService
  ) {}

  public async getAdministratorById(id: string): Promise<Administrator> {
    return await this.administratorRepository.findById(id);
  }

  public async getAdministratorByEmail(email: string): Promise<Administrator> {
    const administrators = await this.administratorRepository.whereEqualTo('email', email).find();
    const administrator = administrators[0];
    if (administrator) {
      if (administrator.master === true) {
        return undefined;
      }
      let userPermissions = {};
      if (administrator.permissions) {
        userPermissions = administrator.permissions;
      }
      const permissions = await this.permissionService.getPermissionsForBusiness(
        administrator.businessId,
        userPermissions
      );
      if (administrator && permissions) {
        administrator.permissions = permissions;
      }
    }
    return administrator;
  }

  public async getAdministratorsByCommerce(
    businessId: string,
    commerceId: string
  ): Promise<Administrator[]> {
    const administratorsCommerce = await this.administratorRepository
      .whereEqualTo('businessId', businessId)
      .whereArrayContains('commercesId', commerceId)
      .whereEqualTo('active', true)
      .find();
    const administratorsBusiness = await this.administratorRepository
      .whereEqualTo('businessId', businessId)
      .whereEqualTo('active', true)
      .find();
    const administratorsBusinessFiltered = administratorsBusiness.filter(
      administrator => !administrator.commercesId || administrator.commercesId.length === 0
    );
    return [...administratorsBusinessFiltered, ...administratorsCommerce];
  }

  public async getMasterAdministratorByEmail(email: string): Promise<Administrator> {
    const administrators = await this.administratorRepository
      .whereEqualTo('email', email)
      .whereEqualTo('master', true)
      .find();
    const administrator = administrators[0];
    if (administrator) {
      const permissions = await this.permissionService.getPermissionsForMaster();
      if (administrator && permissions) {
        administrator.permissions = permissions;
      }
    }
    return administrator;
  }

  public async getAdministratorPermissionsByEmail(
    email: string
  ): Promise<Record<string, number | boolean>> {
    const administrators = await this.administratorRepository.whereEqualTo('email', email).find();
    const administrator = administrators[0];
    return administrator.permissions;
  }

  public async updateToken(id: string, token: string): Promise<Administrator> {
    const administrator = await this.getAdministratorById(id);
    if (administrator) {
      administrator.token = token;
      administrator.lastSignIn = new Date();
    }
    return await this.administratorRepository.update(administrator);
  }

  public async createAdministrator(
    user: string,
    name: string,
    businessId: string,
    commercesId: string[],
    email: string
  ): Promise<Administrator> {
    try {
      const administrator = new Administrator();
      administrator.name = name;
      administrator.commercesId = commercesId || [];
      administrator.email = email;
      administrator.active = true;
      administrator.businessId = businessId;
      administrator.password = '';
      administrator.firstPasswordChanged = false;
      const administratorCreated = await this.administratorRepository.create(administrator);
      const administratorCreatedEvent = new AdministratorCreated(new Date(), administratorCreated, {
        user,
      });
      publish(administratorCreatedEvent);
      return administratorCreated;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al crear el administrador: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async changeStatus(id: string, action: boolean): Promise<Administrator> {
    try {
      const administrator = await this.administratorRepository.findById(id);
      administrator.active = action;
      return this.administratorRepository.update(administrator);
    } catch (error) {
      throw `Hubo un problema al desactivar el administrator: ${error.message}`;
    }
  }

  public async changePassword(id: string): Promise<Administrator> {
    let administrator = await this.administratorRepository.findById(id);
    if (administrator) {
      if (!administrator.firstPasswordChanged) {
        administrator.firstPasswordChanged = true;
      }
      if (administrator.lastPasswordChanged) {
        const days =
          Math.abs(new Date().getTime() - administrator.lastPasswordChanged.getTime()) /
          (1000 * 60 * 60 * 24);
        if (days < 1) {
          throw new HttpException(
            'Limite de cambio de password alcanzado',
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        } else {
          administrator.lastPasswordChanged = new Date();
          administrator = await this.administratorRepository.update(administrator);
          return administrator;
        }
      } else {
        administrator.lastPasswordChanged = new Date();
        administrator = await this.administratorRepository.update(administrator);
        return administrator;
      }
    } else {
      throw new HttpException('Administrador no existe', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getAdministratorsByBusinessId(businessId: string): Promise<Administrator[]> {
    return await this.administratorRepository
      .whereEqualTo('businessId', businessId)
      .orderByAscending('name')
      .find();
  }

  public async updateAdministrator(
    user: string,
    id: string,
    commercesId: string[],
    active: boolean
  ): Promise<Administrator> {
    const administrator = await this.getAdministratorById(id);
    if (commercesId) {
      administrator.commercesId = commercesId;
    }
    if (active !== undefined) {
      administrator.active = active;
    }
    return await this.update(user, administrator);
  }

  public async update(user: string, administrator: Administrator): Promise<Administrator> {
    const administratorUpdated = await this.administratorRepository.update(administrator);
    const administratorUpdatedEvent = new AdministratorUpdated(new Date(), administratorUpdated, {
      user,
    });
    publish(administratorUpdatedEvent);
    return administratorUpdated;
  }

  public async updateAdministratorPermission(
    user: string,
    id: string,
    permissionName: string,
    permissionValue: boolean | number
  ): Promise<Administrator> {
    const administrator = await this.getAdministratorById(id);
    if (administrator) {
      if (!administrator.permissions) {
        administrator.permissions = {};
      }
      if (administrator.permissions) {
        administrator.permissions[permissionName] = permissionValue;
      }
    }
    return await this.update(user, administrator);
  }
}
