import { Client, PersonalInfo } from './model/client.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import { ClientContactType } from 'src/client-contact/model/client-contact-type.enum';
import { ClientContactService } from '../client-contact/client-contact.service';
import ClientCreated from './events/ClientCreated';
import ClientUpdated from './events/ClientUpdated';
import { ClientContactResult } from '../client-contact/model/client-contact-result.enum';

export class ClientService {
  constructor(
  @InjectRepository(Client)
    private clientRepository = getRepository(Client),
    private clientContactService: ClientContactService
  ) {}

  public async getClientById(id: string): Promise<Client> {
    return await this.clientRepository.findById(id);
  }

  public async getClientByIdNumberOrEmail(idNumber: string, email: string): Promise<Client> {
    let client: Client;
    if (idNumber) {
      client = await this.clientRepository.whereEqualTo('idNumber', idNumber).findOne();
    } else if (email && !client || !client.id) {
      client = await this.clientRepository.whereEqualTo('email', email).findOne();
    }
    return client;
  }

  public async getClients(): Promise<Client[]> {
    return await this.clientRepository.find();
  }

  public async saveClient(name?: string, phone?: string, email?: string, lastName?: string, idNumber?: string, personalInfo?: PersonalInfo): Promise<Client> {
    let client: Client;
    let newClient = false;
    client = await this.getClientByIdNumberOrEmail(idNumber, email);
    if (!client) {
      client = new Client();
      newClient = true;
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
    if (personalInfo !== undefined) {
      client.personalInfo = personalInfo;
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

  public async contactClient(user: string, id: string, contactType: ClientContactType, contactResult: ClientContactResult, comment: string, commerceId?: string, collaboratorId?: string): Promise<Client> {
    let clientById = await this.getClientById(id);
    if (clientById && contactResult) {
      await this.clientContactService.createClientContact(
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
      return clientUpdated;
    }
  }
}
