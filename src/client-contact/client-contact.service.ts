import { ClientContact } from './model/client-contact.entity';
import { getRepository} from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { ClientContactType } from './model/client-contact-type.enum';
import { publish } from 'ett-events-lib';
import ClientContactCreated from './events/ClientContactCreated';

export class ClientContactService {
  constructor(
  @InjectRepository(ClientContact)
    private clientContactRepository = getRepository(ClientContact)
  ) {}

  public async getClientContactByClientId(clientId: string): Promise<ClientContact[]> {
    return await this.clientContactRepository.whereEqualTo('clientId', clientId).find();
  }

  public async createClientContact(clientId: string, type: ClientContactType, comment: string, commerceId?: string, collaboratorId?: string): Promise<ClientContact> {
    let clientContact = new ClientContact();
    clientContact.clientId = clientId;
    clientContact.type = type;
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
