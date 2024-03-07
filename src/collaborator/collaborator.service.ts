import { Collaborator } from './model/collaborator.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AdministratorService } from 'src/administrator/administrator.service';
import { publish } from 'ett-events-lib';
import CollaboratorCreated from './events/CollaboratorCreated';
import CollaboratorUpdated from './events/CollaboratorUpdated';
import { PermissionService } from 'src/permission/permission.service';
import * as defaultPermissions from './model/default-permissions.json';
import { CollaboratorType } from './model/collaborator-type.enum';

@Injectable()
export class CollaboratorService {
  constructor(
    @InjectRepository(Collaborator)
    private collaboratorRepository = getRepository(Collaborator),
    private administratorService: AdministratorService,
    private permissionService: PermissionService
  ) {}

  public async getCollaboratorById(id: string): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository.findById(id);
    return collaborator;
  }

  public async getCollaborators(): Promise<Collaborator[]> {
    const collaborators = await this.collaboratorRepository.find();
    return collaborators;
  }

  public async getCollaboratorByEmail(email: string): Promise<Collaborator> {
    const collaborators = await this.collaboratorRepository.whereEqualTo('email', email).find();
    const collaborator = collaborators[0];
    let userPermissions = {};
    if (collaborator) {
      if (collaborator.permissions) {
        userPermissions = collaborator.permissions;
      }
      const permissions = await this.permissionService.getPermissionsForCollaborator(collaborator.commerceId, userPermissions);
      if (permissions) {
        collaborator.permissions = permissions;
      }
    } else {
      throw new HttpException(`Colaborador no existe`, HttpStatus.NOT_FOUND);
    }
    return collaborator;
  }

  public async getCollaboratorBot(commerceId: string): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository
    .whereEqualTo('commerceId', commerceId)
    .whereEqualTo('bot', true)
    .find();
    return collaborator[0];
  }

  public async getCollaboratorsByCommerceId(commerceId: string): Promise<Collaborator[]> {
    return await this.collaboratorRepository
    .whereEqualTo('commerceId', commerceId)
    .orderByAscending('name')
    .find();
  }

  public async update(user: string, collaborator: Collaborator): Promise<Collaborator> {
    const collaboratorUpdated = await this.collaboratorRepository.update(collaborator);
    const collaboratorUpdatedEvent = new CollaboratorUpdated(new Date(), collaboratorUpdated, { user });
    publish(collaboratorUpdatedEvent);
    return collaboratorUpdated;
  }

  public async updateCollaborator(user: string, id: string, moduleId: string, phone: string, active: boolean, alias: string, servicesId: string[], type: CollaboratorType, commercesId: string[]): Promise<Collaborator> {
    let collaborator = await this.getCollaboratorById(id);
    if (moduleId) {
      collaborator.moduleId = moduleId;
    }
    if (phone) {
      collaborator.phone = phone;
    }
    if (active !== undefined) {
      collaborator.active = active;
    }
    if (alias) {
      collaborator.alias = alias;
    }
    if (servicesId) {
      collaborator.servicesId = servicesId;
    }
    if (type) {
      collaborator.type = type;
    }
    if (commercesId) {
      collaborator.commercesId = commercesId;
      if (commercesId.length === 1) {
        collaborator.commerceId = commercesId[0];
      }
    }
    return await this.update(user, collaborator);
  }

  public async updateToken(user: string, id: string, token: string): Promise<Collaborator> {
    let collaborator = await this.getCollaboratorById(id);
    collaborator.token = token;
    collaborator.lastSignIn = new Date();
    return await this.update(user, collaborator);
  }

  public async createCollaborator(user: string, name: string, commerceId: string, commercesId: string[], email: string, type: CollaboratorType, phone: string, moduleId: string, bot: boolean = false, alias: string, servicesId: string[]): Promise<Collaborator> {
    try {
      let collaborator = new Collaborator();
      collaborator.name = name;
      collaborator.commerceId = commerceId;
      collaborator.commercesId = commercesId || [commerceId];
      collaborator.administratorId = '';
      collaborator.bot = bot;
      collaborator.type = type || CollaboratorType.STANDARD;
      if (collaborator.bot === true) {
        const collaboratorBot = await this.getCollaboratorBot(commerceId);
        if (collaboratorBot) {
          throw new HttpException(`Colaborador Bot ya existe`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        collaborator.email = 'bot@estuturno.app';
        collaborator.phone = '1111111111';
        collaborator.moduleId = 'N/A';
      } else {
        collaborator.email = email;
        collaborator.phone = phone;
        collaborator.moduleId = moduleId;
      }
      collaborator.active = true;
      collaborator.alias = alias || name;
      if (defaultPermissions) {
        collaborator.permissions = defaultPermissions;
      }
      if (servicesId) {
        collaborator.servicesId = servicesId;
      }
      const collaboratorCreated = await this.collaboratorRepository.create(collaborator);
      const collaboratorCreatedEvent = new CollaboratorCreated(new Date(), collaboratorCreated, { user });
      publish(collaboratorCreatedEvent);
      return collaboratorCreated;
    } catch(error) {
      throw new HttpException(`Hubo un problema al crear el colaborador: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async changeStatus(user: string, id: string, action: boolean): Promise<Collaborator> {
    try {
      let collaborator = await this.collaboratorRepository.findById(id);
      collaborator.active = action;
      await this.administratorService.changeStatus(collaborator.administratorId, action);
      return await this.update(user, collaborator);
    } catch(error){
      throw `Hubo un problema al activar o desactivar el colaborador: ${error.message}`;
    }
  }

  public async changePassword(user: string, id: string): Promise<Collaborator> {
    let collaborator = await this.collaboratorRepository.findById(id);
    if (collaborator) {
      if (!collaborator.firstPasswordChanged) {
        collaborator.firstPasswordChanged = true;
      }
      if (collaborator.lastPasswordChanged) {
        let days = Math.abs(new Date().getTime() - collaborator.lastPasswordChanged.getTime()) / (1000 * 60 * 60 * 24);
        if (days < 1) {
          throw new HttpException('Limite de cambio de password alcanzado', HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        collaborator.lastPasswordChanged = new Date();
        collaborator = await this.update(user, collaborator);
        return collaborator;
      }
    } else {
      throw new HttpException('Colaborador no existe', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async updateCollaboratorPermission(user: string, id: string, permissionName: string, permissionValue: boolean|number): Promise<Collaborator> {
    let collaborator = await this.getCollaboratorById(id);
    if (collaborator) {
      if (!collaborator.permissions) {
        collaborator.permissions = {}
      }
      if (collaborator.permissions) {
        collaborator.permissions[permissionName] = permissionValue;
      }
    }
    return await this.update(user, collaborator);
  }
}