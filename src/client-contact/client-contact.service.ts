import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import ClientContactCreated from './events/ClientContactCreated';
import { ClientContactResult } from './model/client-contact-result.enum';
import { ClientContactType } from './model/client-contact-type.enum';
import { ClientContact } from './model/client-contact.entity';

export class ClientContactService {
  constructor(
    @InjectRepository(ClientContact)
    private clientContactRepository = getRepository(ClientContact)
  ) {}

  public async getClientContactByClientId(clientId: string): Promise<ClientContact[]> {
    return await this.clientContactRepository.whereEqualTo('clientId', clientId).find();
  }

  public async createClientContact(
    clientId: string,
    type: ClientContactType,
    result: ClientContactResult,
    comment: string,
    commerceId?: string,
    collaboratorId?: string
  ): Promise<ClientContact> {
    const clientContact = new ClientContact();
    clientContact.clientId = clientId;
    clientContact.type = type;
    clientContact.result = result;
    clientContact.comment = comment;
    if (commerceId) {
      clientContact.commerceId = commerceId;
    }
    if (collaboratorId) {
      clientContact.collaboratorId = collaboratorId;
    }
    clientContact.createdAt = new Date();
    const clientContactCreated = await this.clientContactRepository.create(clientContact);
    const clientContactCreatedEvent = new ClientContactCreated(new Date(), clientContactCreated);
    publish(clientContactCreatedEvent);
    return clientContactCreated;
  }
}
