import { User, PersonalInfo } from './model/user.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import UserCreated from './events/UserCreated';
import UserUpdated from './events/UserUpdated';
import { ClientService } from '../client/client.service';
import { UserType } from './model/user-type.enum';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CommerceService } from '../commerce/commerce.service';

export class UserService {
  constructor(
  @InjectRepository(User)
    private userRepository = getRepository(User),
    private clientService: ClientService,
    private commerceService: CommerceService
  ) {}

  public async getUserById(id: string): Promise<User> {
    return await this.userRepository.findById(id);
  }

  public async getUsers(): Promise<User[]> {
    return await this.userRepository.find();
  }

  public async createUser (
    name?: string, phone?: string, email?: string, commerceId?: string, queueId?: string, lastName?: string,
    idNumber?: string, notificationOn?: boolean, notificationEmailOn?: boolean, personalInfo?: PersonalInfo,
    clientId?: string, acceptTermsAndConditions?: boolean): Promise<User> {
    let user = new User();
    let client;
    if (!commerceId) {
      throw new HttpException(`Error creando User: Debe enviarse el commerceId`, HttpStatus.INTERNAL_SERVER_ERROR);
    } else {
      user.commerceId = commerceId;
      const commerce = await this.commerceService.getCommerce(commerceId);
      const businessId = commerce.businessId;
      user.businessId = businessId;
    }
    if (clientId) {
      client = await this.clientService.getClientById(clientId);
      if (!client || !client.id) {
        throw new HttpException(`Error creando User: Cliente no existe ${clientId}`, HttpStatus.INTERNAL_SERVER_ERROR);
      } else {
        if (client.name) {
          user.name = client.name;
        }
        if (client.lastName) {
          user.lastName = client.lastName;
        }
        if (client.idNumber) {
          user.idNumber = client.idNumber;
        }
        if (client.phone) {
          user.phone = client.phone;
        }
        if (client.email) {
          user.email = client.email;
        }
        if (personalInfo !== undefined && Object.keys(personalInfo).length > 0) {
          user.personalInfo = { ...user.personalInfo || {}, ...personalInfo };
        }
      }
    }
    if (name) {
      user.name = name;
    }
    if (lastName) {
      user.lastName = lastName || client.name;
    }
    if (idNumber) {
      user.idNumber = idNumber || client.name;
    }
    if (phone) {
      user.phone = phone || client.name;
    }
    if (email) {
      user.email = email || client.name;
    }
    if (queueId) {
      user.queueId = queueId;
    }
    if (notificationOn !== undefined) {
      user.notificationOn = notificationOn;
    }
    if (notificationEmailOn !== undefined) {
      user.notificationEmailOn = notificationEmailOn;
    }
    if (personalInfo !== undefined && Object.keys(personalInfo).length > 0) {
      user.personalInfo = { ...user.personalInfo || {}, ...personalInfo };
    }
    if (acceptTermsAndConditions !== undefined) {
      user.acceptTermsAndConditions = acceptTermsAndConditions;
    }
    user.type = UserType.STANDARD;
    user.frequentCustomer = false;
    user.createdAt = new Date();
    const userCreated = await this.userRepository.create(user);
    await this.clientService.saveClient(
      clientId,
      user.businessId,
      user.commerceId,
      user.name,
      user.phone,
      user.email,
      user.lastName,
      user.idNumber,
      user.personalInfo
    );
    const userCreatedEvent = new UserCreated(new Date(), userCreated);
    publish(userCreatedEvent);
    return userCreated;
  }

  public async updateUser(user: string, id: string, name?: string, phone?: string, email?: string, commerceId?: string, queueId?: string, lastName?: string, idNumber?: string, notificationOn?: boolean, notificationEmailOn?: boolean, personalInfo?: PersonalInfo): Promise<User> {
    try {
      let userById = await this.userRepository.findById(id);
      if (name) {
        userById.name = name;
      }
      if (lastName) {
        userById.lastName = lastName;
      }
      if (idNumber) {
        userById.idNumber = idNumber;
      }
      if (phone) {
        userById.phone = phone;
      }
      if (email) {
        userById.email = email;
      }
      if (commerceId) {
        userById.commerceId = commerceId;
      }
      if (queueId) {
        userById.queueId = queueId;
      }
      if (notificationOn !== undefined) {
        userById.notificationOn = notificationOn;
      }
      if (notificationEmailOn !== undefined) {
        userById.notificationEmailOn = notificationEmailOn;
      }
      if (personalInfo !== undefined && Object.keys(personalInfo).length > 0) {
        userById.personalInfo = { ...userById.personalInfo || {}, ...personalInfo };
      }
      const userUpdated = await this.userRepository.update(userById);
      const userUpdatedEvent = new UserUpdated(new Date(), userUpdated, { user });
      publish(userUpdatedEvent);
      return userUpdated;
    } catch (error) {
      throw `Hubo un problema al modificar el usuario: ${error.message}`;
    }
  }

  public async update(user: string, userById: User): Promise<User> {
    const userUpdated = await this.userRepository.update(userById);
    await this.clientService.saveClient(
      undefined,
      userById.businessId,
      userById.commerceId,
      userById.name,
      userById.phone,
      userById.email,
      userById.lastName,
      userById.idNumber,
      userById.personalInfo
    );
    const userUpdatedEvent = new UserUpdated(new Date(), userUpdated, { user });
    publish(userUpdatedEvent);
    return userUpdated;
  }
}
