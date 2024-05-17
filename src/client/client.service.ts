import { Client, PersonalInfo } from './model/client.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import { ClientContactType } from 'src/client-contact/model/client-contact-type.enum';
import { ClientContactService } from '../client-contact/client-contact.service';
import ClientCreated from './events/ClientCreated';
import ClientUpdated from './events/ClientUpdated';
import { ClientContactResult } from '../client-contact/model/client-contact-result.enum';
import { ClientContact } from 'src/client-contact/model/client-contact.entity';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CommerceService } from '../commerce/commerce.service';
import { Commerce } from 'src/commerce/model/commerce.entity';
import { FeatureToggleName } from 'src/feature-toggle/model/feature-toggle.enum';
import { ClientSearchDto } from './dto/client-search.dto';
import { FeatureToggle } from '../feature-toggle/model/feature-toggle.entity';

export class ClientService {
  constructor(
  @InjectRepository(Client)
    private clientRepository = getRepository(Client),
    private clientContactService: ClientContactService,
    private commerceService: CommerceService
  ) {}

  public async getClientById(id: string): Promise<Client> {
    return await this.clientRepository.findById(id);
  }

  private getActiveFeature(commerce: Commerce, name: string, type: string): Boolean {
    let active = false;
    let features = [];
    if (commerce !== undefined && commerce.features && commerce.features.length > 0) {
      features = commerce.features.filter(feature => feature.type === type && feature.name === name);
      if (features.length > 0) {
        return features[0]['active'];
      }
    }
    return active;
  }

  private getActiveFeatureType(commerce: Commerce, type: string): FeatureToggle[] {
    let features = [];
    if (commerce !== undefined && commerce.features && commerce.features.length > 0) {
      features = commerce.features.filter(feature => feature.type === type);
      if (features.length > 0) {
        return features;
      }
    }
    return [];
  }

  public async searchClient(commerceId: string, idNumber: string): Promise<ClientSearchDto> {
    let response: ClientSearchDto = new ClientSearchDto();
    const commerce = await this.commerceService.getCommerceById(commerceId);
    if (commerce && commerce.id) {
      if (commerce.features && commerce.features.length > 0) {
        if (this.getActiveFeature(commerce, 'attention-user-search', FeatureToggleName.USER)) {
          const client = await this.clientRepository
            .whereEqualTo('commerceId', commerceId)
            .whereEqualTo('idNumber', idNumber)
            .findOne();
          if (client && client.id) {
            response.id = client.id;
            response.idNumber = client.idNumber;
            response.name = client.name;
            response.businessId = client.businessId;
            response.commerceId = client.commerceId;
            const features = this.getActiveFeatureType(commerce, FeatureToggleName.USER);
            const neededToInclude = [];
            if (features.length > 0) {
              const type = 'attention-user';
              const featuresToValidate = [];
              features.forEach(feature => {
                if (feature.name.includes(type) && feature.active === true) {
                  featuresToValidate.push(feature.name);
                }
              });
              if (featuresToValidate.length > 0) {
                const toValidate = ['name', 'lastName', 'phone', 'email', 'birthday', 'origin', 'idNumber', 'code1', 'code2', 'code3', 'address'];
                toValidate.forEach(toValid => {
                  if (toValid === 'address') {
                    if (featuresToValidate.includes(`${type}-${toValid}`)) {
                      if (
                        (!client[`${toValid}Text`] && !client.personalInfo[`${toValid}Text`]) ||
                        (!client[`${toValid}Code`] && !client.personalInfo[`${toValid}Code`]) ||
                        (!client[`${toValid}Complement`] && !client.personalInfo[`${toValid}Complement`])
                      ) {
                        neededToInclude.push(`${type}-${toValid}`);
                      }
                    }
                  } else if (featuresToValidate.includes(`${type}-${toValid}`)) {
                    if (!client[toValid] && !client.personalInfo[toValid]) {
                      neededToInclude.push(`${type}-${toValid}`);
                    }
                  }
                })
                response.neededToInclude = neededToInclude;
              }
            }
          } else {
            throw new HttpException(`Cliente no encontrado`, HttpStatus.NOT_FOUND);
          }
        } else {
          throw new HttpException(`No puede realizar esta acción`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }
    } else {
      throw new HttpException(`No puede realizar esta acción`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return response;
  }

  public async getClientByIdNumberOrEmail(businessId: string, idNumber: string, email: string): Promise<Client> {
    let client: Client;
    if (idNumber) {
      client = await this.clientRepository
        .whereEqualTo('businessId', businessId)
        .whereEqualTo('idNumber', idNumber)
        .findOne();
    } else if (email && !client) {
      client = await this.clientRepository
        .whereEqualTo('businessId', businessId)
        .whereEqualTo('email', email).findOne();
    }
    return client;
  }

  public async getClients(): Promise<Client[]> {
    return await this.clientRepository.find();
  }

  public async saveClient(clientId?: string, businessId?: string, commerceId?: string, name?: string, phone?: string, email?: string, lastName?: string, idNumber?: string, personalInfo?: PersonalInfo): Promise<Client> {
    let client: Client;
    let newClient = false;
    if (clientId !== undefined) {
      client = await this.getClientById(clientId);
    } else {
      client = await this.getClientByIdNumberOrEmail(businessId, idNumber, email);
    }
    if (!client) {
      client = new Client();
      newClient = true;
      if (businessId) {
        client.businessId = businessId;
      }
    }
    if (commerceId) {
      client.commerceId = commerceId;
    }
    if (idNumber) {
      client.idNumber = idNumber;
    }
    if (name) {
      client.name = name;
    }
    if (lastName) {
      client.lastName = lastName;
    }
    if (phone) {
      client.phone = phone;
    }
    if (email) {
      client.email = email;
    }
    if (personalInfo !== undefined && Object.keys(personalInfo).length > 0) {
      client.personalInfo = { ...client.personalInfo || {}, ...personalInfo };
    }
    client.frequentCustomer = false;
    client.createdAt = new Date();
    if (newClient) {
      client.counter = 0;
      const clientCreated = await this.clientRepository.create(client);
      client = clientCreated;
      const clientCreatedEvent = new ClientCreated(new Date(), clientCreated);
      publish(clientCreatedEvent);
    } else {
      client.counter = client.counter + 1;
      client.frequentCustomer = true;
      const clientUpdated = await this.update(client.email || client.idNumber, client)
      client = clientUpdated;
      const clientUpdatedEvent = new ClientUpdated(new Date(), clientUpdated, { client });
      publish(clientUpdatedEvent);
    }
    return client;
  }

  public async update(user: string, clientById: Client): Promise<Client> {
    const clientUpdated = await this.clientRepository.update(clientById);
    const clientUpdatedEvent = new ClientUpdated(new Date(), clientUpdated, { user });
    publish(clientUpdatedEvent);
    return clientUpdated;
  }

  public async contactClient(user: string, id: string, contactType: ClientContactType, contactResult: ClientContactResult, comment: string, commerceId?: string, collaboratorId?: string): Promise<ClientContact> {
    let clientById = await this.getClientById(id);
    if (clientById && contactResult) {
      const result = await this.clientContactService.createClientContact(
        clientById.id,
        contactType,
        contactResult,
        comment,
        commerceId,
        collaboratorId
      );
      clientById.contacted = true;
      clientById.contactedDate = new Date();
      clientById.contactResult = contactResult;
      if (comment) {
        clientById.contactResultComment = comment;
      }
      if (collaboratorId) {
        clientById.contactResultCollaboratorId = collaboratorId;
      }
      const clientUpdated = await this.update(user, clientById);
      clientUpdated.clientContacts = await this.clientContactService.getClientContactByClientId(id);
      return result;
    }
  }

  public async updateFirstAttentionForm(user: string, id: string): Promise<Client> {
    let clientById = await this.getClientById(id);
    if (clientById && clientById.id) {
      clientById.firstAttentionForm = true;
      clientById.updatedAt = new Date();
      return await this.update(user, clientById);
    }
  }
  public async updateClient(user: string, id?: string, businessId?: string, commerceId?: string, name?: string, phone?: string, email?: string, lastName?: string, idNumber?: string, personalInfo?: PersonalInfo): Promise<Client> {
    let client: Client;
    let newClient = false;
    if (id !== undefined) {
      client = await this.getClientById(id);
    } else {
      client = await this.getClientByIdNumberOrEmail(businessId, idNumber, email);
    }
    if (!client) {
      client = new Client();
      newClient = true;
      if (businessId) {
        client.businessId = businessId;
      }
    }
    if (commerceId) {
      client.commerceId = commerceId;
    }
    if (idNumber) {
      client.idNumber = idNumber;
    }
    if (name) {
      client.name = name;
    }
    if (lastName) {
      client.lastName = lastName;
    }
    if (phone) {
      client.phone = phone;
    }
    if (email) {
      client.email = email;
    }
    if (personalInfo !== undefined && Object.keys(personalInfo).length > 0) {
      client.personalInfo = { ...client.personalInfo || {}, ...personalInfo };
    }
    client.frequentCustomer = false;
    client.createdAt = new Date();
    if (newClient) {
      client.counter = 0;
      const clientCreated = await this.clientRepository.create(client);
      client = clientCreated;
      const clientCreatedEvent = new ClientCreated(new Date(), clientCreated, { user });
      publish(clientCreatedEvent);
    } else {
      client.counter = client.counter + 1;
      client.frequentCustomer = true;
      const clientUpdated = await this.update(client.email || client.idNumber, client)
      client = clientUpdated;
      const clientUpdatedEvent = new ClientUpdated(new Date(), clientUpdated, { user });
      publish(clientUpdatedEvent);
    }
    return client;
  }
}
