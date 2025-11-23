import { HttpException, HttpStatus } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { AdministratorService } from '../administrator/administrator.service';
import { CommerceService } from '../commerce/commerce.service';
import { FeatureToggle } from '../feature-toggle/model/feature-toggle.entity';

import MessageCreated from './events/MessageCreated';
import MessageUpdated from './events/MessageUpdated';
import { Message } from './model/message.entity';
import { MessageType } from './model/type.enum';

export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository = getRepository(Message),
    private administratorService: AdministratorService,
    private commerceService: CommerceService
  ) {}

  public async getMessageById(id: string): Promise<Message> {
    return await this.messageRepository.findById(id);
  }

  public async getMessages(): Promise<Message[]> {
    return await this.messageRepository.find();
  }

  public async getMessagesByClient(clientId: string): Promise<Message[]> {
    const messages: Message[] = await this.messageRepository
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('read', false)
      .find();
    return messages;
  }

  public async getMessagesByAdministrator(administratorId: string): Promise<Message[]> {
    const messages: Message[] = await this.messageRepository
      .whereEqualTo('administratorId', administratorId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('read', false)
      .find();
    return messages;
  }

  public async getMessagesByCollaborator(collaboratorId: string): Promise<Message[]> {
    const messages: Message[] = await this.messageRepository
      .whereEqualTo('collaboratorId', collaboratorId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('read', false)
      .find();
    return messages;
  }

  public async getMessagesByAdministratorAndType(
    administratorId: string,
    type: string
  ): Promise<Message[]> {
    const messages: Message[] = await this.messageRepository
      .whereEqualTo('administratorId', administratorId)
      .whereEqualTo('type', type)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .whereEqualTo('read', false)
      .find();
    return messages;
  }

  featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  public async createMessage(
    user: string,
    type: MessageType,
    commerceId: string,
    administratorId: string,
    collaboratorId: string,
    clientId: string,
    title: string,
    content: string,
    link: string,
    icon: string
  ): Promise<Message> {
    const message = new Message();
    message.commerceId = commerceId;
    if (administratorId) {
      message.administratorId = administratorId;
    }
    if (collaboratorId) {
      message.collaboratorId = collaboratorId;
    }
    if (clientId) {
      message.clientId = clientId;
    }
    message.title = title;
    message.content = content;
    message.link = link;
    message.type = type || MessageType.STANDARD;
    message.icon = icon;
    message.active = true;
    message.available = true;
    message.read = false;
    message.createdAt = new Date();
    const messageCreated = await this.messageRepository.create(message);
    const messageCreatedEvent = new MessageCreated(new Date(), messageCreated, { user });
    publish(messageCreatedEvent);
    return messageCreated;
  }

  public async update(user: string, message: Message): Promise<Message> {
    const messageUpdated = await this.messageRepository.update(message);
    const messageUpdatedEvent = new MessageUpdated(new Date(), messageUpdated, { user });
    publish(messageUpdatedEvent);
    return messageUpdated;
  }

  public async updateMessageConfigurations(
    user: string,
    id: string,
    active,
    available,
    read
  ): Promise<Message> {
    try {
      const message = await this.messageRepository.findById(id);
      if (active !== undefined) {
        message.active = active;
      }
      if (available !== undefined) {
        message.available = available;
      }
      if (read !== undefined) {
        message.read = read;
      }
      const messageUpdated = await this.messageRepository.update(message);
      const messageUpdatedEvent = new MessageUpdated(new Date(), messageUpdated, { user });
      publish(messageUpdatedEvent);
      return messageUpdated;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el mensaje: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async markAllAsRead(
    user: string,
    administratorId: string,
    collaboratorId: string,
    clientId: string
  ): Promise<Message[]> {
    try {
      let messages;
      const result = [];
      if (administratorId) {
        messages = await this.getMessagesByAdministrator(administratorId);
      }
      if (collaboratorId) {
        messages = await this.getMessagesByCollaborator(collaboratorId);
      }
      if (clientId) {
        messages = await this.getMessagesByClient(clientId);
      }
      if (messages && messages.length > 0) {
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          message.read = true;
          message.reatAt = new Date();
          const messageResult = await this.update(user, message);
          result.push(messageResult);
        }
      }
      return result;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al marcar los mensajes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async sendMessageToAdministrator(
    user: string,
    commerceId: string,
    type: MessageType,
    messageToSend: any
  ): Promise<Message[]> {
    try {
      const messages = [];
      const commerce = await this.commerceService.getCommerceById(commerceId);
      if (commerce && commerce.id) {
        const commerceLanguage = commerce.localeInfo.language;
        const msg = messageToSend[commerceLanguage];
        if (msg.toggle && commerce.features && commerce.features.length > 0) {
          if (this.featureToggleIsActive(commerce.features, msg.toggle)) {
            const businessId = commerce.businessId;
            const administrators = await this.administratorService.getAdministratorsByCommerce(
              businessId,
              commerceId
            );
            if (administrators && administrators.length > 0) {
              for (let i = 0; i < administrators.length; i++) {
                const administrator = administrators[i];
                const existingMessage = await this.getMessagesByAdministratorAndType(
                  administrator.id,
                  type
                );
                if (!existingMessage || existingMessage.length === 0) {
                  const message = await this.createMessage(
                    user,
                    type,
                    commerceId,
                    administrator.id,
                    undefined,
                    undefined,
                    msg.title,
                    msg.content,
                    msg.link,
                    msg.icon
                  );
                  messages.push(message);
                }
              }
              return messages;
            }
          }
        }
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al enviar los mensajes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
