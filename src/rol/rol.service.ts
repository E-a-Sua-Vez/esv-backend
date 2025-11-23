import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import RolCreated from './events/RolCreated';
import RolUpdated from './events/RolUpdated';
import { Rol } from './model/rol.entity';
import * as roles from './model/rol.json';

export class RolService {
  constructor(
    @InjectRepository(Rol)
    private rolRepository = getRepository(Rol)
  ) {}

  public async getRolById(id: string): Promise<Rol> {
    return await this.rolRepository.findById(id);
  }

  public async getRoles(): Promise<Rol[]> {
    return await this.rolRepository.find();
  }

  public async getRolByName(name: string): Promise<Rol> {
    const rol = await this.rolRepository.whereEqualTo('name', name).find();
    return rol[0];
  }

  public async createRol(
    user: string,
    name: string,
    description: string,
    permissions: Record<string, boolean | number>
  ): Promise<Rol> {
    const rol = new Rol();
    rol.name = name;
    rol.description = description;
    rol.permissions = permissions;
    rol.active = true;
    rol.createdAt = new Date();
    const rolCreated = await this.rolRepository.create(rol);
    const rolCreatedEvent = new RolCreated(new Date(), rolCreated, { user });
    publish(rolCreatedEvent);
    return rolCreated;
  }

  public async update(user, rol: Rol): Promise<Rol> {
    const rolUpdated = await this.rolRepository.update(rol);
    const rolUpdatedEvent = new RolUpdated(new Date(), rolUpdated, { user });
    publish(rolUpdatedEvent);
    return rolUpdated;
  }

  public async updateRolPermission(
    user: string,
    id: string,
    permissionName: string,
    permissionValue: boolean | number
  ): Promise<Rol> {
    const rol = await this.getRolById(id);
    if (rol) {
      if (rol.permissions) {
        rol.permissions[permissionName] = permissionValue;
      }
    }
    return await this.update(user, rol);
  }

  public async initRol(user: string): Promise<Rol[]> {
    const rolesCreated = [];
    const rolesToCreate = roles;
    for (let i = 0; i < rolesToCreate.length; i++) {
      const rolToCreate = rolesToCreate[i];
      const rol = new Rol();
      rol.name = rolToCreate.name;
      rol.description = rolToCreate.description;
      rol.permissions = rolToCreate.permissions;
      rol.active = true;
      rol.createdAt = new Date();
      const rolCreated = await this.rolRepository.create(rol);
      rolesCreated.push(rolCreated);
      const rolCreatedEvent = new RolCreated(new Date(), rolCreated, { user });
      publish(rolCreatedEvent);
    }
    return rolesCreated;
  }
}
