import { Administrator } from './administrator.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PermissionService } from '../permission/permission.service';

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
      const permissions = await this.permissionService.getPermissionsForBusiness(administrator.businessId, userPermissions);
      if (administrator && permissions) {
        administrator.permissions = permissions;
      }
    }
    return administrator;
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

  public async getAdministratorPermissionsByEmail(email: string): Promise<Record<string, number | boolean>> {
    const administrators = await this.administratorRepository.whereEqualTo('email', email).find();
    const administrator = administrators[0];
    return administrator.permissions;
  }

  public async updateToken(id: string, token: string): Promise<Administrator> {
    let administrator = await this.getAdministratorById(id);
    if (administrator) {
      administrator.token = token;
      administrator.lastSignIn = new Date();
    }
    return await this.administratorRepository.update(administrator);
  }

  public async createAdministrator(name: string, businessId: string, commerceIds: [string], email: string): Promise<Administrator> {
    let administrator = new Administrator();
    administrator.name = name;
    administrator.commerceIds = commerceIds;
    administrator.email = email;
    administrator.active = true;
    administrator.businessId = businessId;
    administrator.password = '';
    administrator.firstPasswordChanged = false;
    return await this.administratorRepository.create(administrator);
  }

  public async changeStatus(id: string, action: boolean): Promise<Administrator> {
    try {
      let administrator = await this.administratorRepository.findById(id);
      administrator.active = action;
      return this.administratorRepository.update(administrator);
    } catch(error){
      throw `Hubo un problema al desactivar el administrator: ${error.message}`;
    }
  }

  public async changePassword(id: string): Promise<Administrator> {
    let administrator = await this.administratorRepository.findById(id);
    if (administrator) {
      if (!administrator.firstPasswordChanged) {
        administrator.firstPasswordChanged = true;
      }
      let days = Math.abs(new Date().getTime() - administrator.lastPasswordChanged.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 1) {
        throw new HttpException('Limite de cambio de password alcanzado', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      administrator.lastPasswordChanged = new Date();
      administrator = await this.administratorRepository.update(administrator);
      return administrator;
    } else {
      throw new HttpException('Administrador no existe', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
