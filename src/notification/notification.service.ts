import { Notification } from './model/notification.entity';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { NotificationChannel } from './model/notification-channel.enum';
import { NotificationType } from './model/notification-type.enum';
import { publish } from 'ett-events-lib';
import NotificationCreated from './events/NotificationCreated';
import { NotificationClient } from './infrastructure/notification-client';
import { clientStrategy } from './infrastructure/notification-client-strategy';
import { NotificationProvider } from './model/notification-provider';
import { EmailInputDto, RawEmailInputDto, Attachment } from './model/email-input.dto';
import NotificationReceived from './events/NotificationReceived';
import { NotificationThirdPartyDto } from './model/notification-third-party.dto';
import NotificationUpdated from './events/NotificationUpdated';


@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository = getRepository(Notification),
    @Inject(forwardRef(() => clientStrategy(NotificationChannel.WHATSAPP)))
    private whatsappNotificationClient: NotificationClient,
    @Inject(forwardRef(() => clientStrategy(NotificationChannel.EMAIL)))
    private emailNotificationClient: NotificationClient
  ) { }

  private readonly whatsappProvider = process.env.WHATSAPP_NOTIFICATION_PROVIDER || 'N/I';
  private readonly emailProvider = process.env.EMAIL_NOTIFICATION_PROVIDER || 'N/I';

  public async getNotificationById(id: string): Promise<Notification> {
    return await this.notificationRepository.findById(id);
  }

  public async getNotifications(): Promise<Notification[]> {
    return await this.notificationRepository.find();
  }

  public async update(notification: Notification): Promise<Notification> {
    const notificationUpdated = await this.notificationRepository.update(notification);
    const notificationUpdatedEvent = new NotificationUpdated(new Date(), notificationUpdated);
    publish(notificationUpdatedEvent);
    return notificationUpdated;
  }

  public async createWhatsappNotification(
    phone: string,
    userId: string,
    message: string,
    type: NotificationType,
    attentionId: string,
    commerceId: string,
    queueId: string,
    servicePhoneNumber: string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.WHATSAPP;
    notification.type = type;
    notification.receiver = userId;
    notification.attentionId = attentionId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    notification.provider = this.whatsappProvider;
    const notificationCreated = await this.notificationRepository.create(notification);
    const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated);
    publish(notificationCreatedEvent);
    let metadata;
    try {
      metadata = await this.whatsappNotify(phone, message, notificationCreated.id, commerceId, servicePhoneNumber);
      if (this.whatsappProvider === NotificationProvider.TWILIO) {
        notificationCreated.twilioId = metadata['sid'];
        notificationCreated.providerId = metadata['sid'];
      }
      if (this.whatsappProvider === NotificationProvider.WHATSGW) {
        notificationCreated.twilioId = 'N/A';
        notificationCreated.providerId = metadata['message_id'] || 'N/I';
      }
    } catch (error) {
      notificationCreated.comment = error.message;
    }
    return await this.update(notificationCreated);
  }

  public async createEmailNotification(
    email: string,
    userId: string,
    type: NotificationType,
    attentionId: string,
    commerceId: string,
    queueId: string,
    template: string,
    attentionNumber: number,
    commerce: string,
    link: string,
    logo: string,
    moduleNumber: string,
    collaboratorName: string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.receiver = userId;
    notification.attentionId = attentionId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    let metadata;
    try {
      const templateData = {
        attentionNumber,
        commerce,
        link,
        logo,
        moduleNumber,
        collaboratorName
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email]
        },
        Template: template,
        TemplateData: JSON.stringify(templateData)
      };
      metadata = await this.emailNotify(email, data, template);
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, { metadata });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  public async whatsappNotify(phone: string, message: string, notificationId: string, commerceId: string, servicePhoneNumber?: string): Promise<string> {
    return this.whatsappNotificationClient.sendMessage(message, phone, notificationId, servicePhoneNumber);
  }

  public async emailNotify(email: string, data: EmailInputDto, template: string): Promise<any> {
    if (!email) {
      throw new Error('Cliente no tiene direccion email');
    }
    const body = { ...data, TemplateData: data.TemplateData, Template: template };
    return this.emailNotificationClient.sendEmail(body);
  }

  public async rawEmailNotify(data: RawEmailInputDto): Promise<any> {
    return this.emailNotificationClient.sendRawEmail(data);
  }

  public async createBookingRawEmailNotification(
    type: NotificationType,
    bookingId: string,
    commerceId: string,
    from: string,
    to: string[],
    subject: string,
    attachments: Attachment[],
    html: string,
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.bookingId = bookingId;
    notification.commerceId = commerceId;
    let metadata;
    try {
      metadata = await this.rawEmailNotify(
        {
          from,
          to,
          subject,
          html,
          attachments
        }
      );
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, { metadata });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  public async createAttentionRawEmailNotification(
    type: NotificationType,
    attentionId: string,
    commerceId: string,
    from: string,
    to: string[],
    subject: string,
    attachments: Attachment[],
    html: string,
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.attentionId = attentionId;
    notification.commerceId = commerceId;
    let metadata;
    try {
      metadata = await this.rawEmailNotify(
        {
          from,
          to,
          subject,
          html,
          attachments
        }
      );
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, { metadata });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  public async createAttentionEmailNotification(
    email: string,
    userId: string,
    type: NotificationType,
    attentionId: string,
    commerceId: string,
    queueId: string,
    template: string,
    attentionNumber: number,
    commerce: string,
    link: string,
    logo: string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.receiver = userId;
    notification.attentionId = attentionId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    let metadata;
    try {
      const templateData = {
        attentionNumber,
        commerce,
        link,
        logo
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email]
        },
        Template: template,
        TemplateData: JSON.stringify(templateData)
      };
      metadata = await this.emailNotify(email, data, template);
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, { metadata });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  public async createNotificationReceived(provider: string, body: any): Promise<any> {
    const id = body['message_custom_id'] || undefined;
    if (id !== undefined) {
      const thirdPartyNotification = new NotificationThirdPartyDto();
      thirdPartyNotification.eventType = body['event'] || 'N/I';
      thirdPartyNotification.apiKey = body['apikey'] || 'N/I';
      thirdPartyNotification.phoneNumber = body['phone_number'] || 'N/I';
      thirdPartyNotification.wInstanciaId = body['w_instancia_id'] || 'N/I';
      thirdPartyNotification.contactPhoneNumber = body['contact_phone_number'] || 'N/I';
      thirdPartyNotification.contactName = body['contact_name'] || 'N/I';
      thirdPartyNotification.chatType = body['chat_type'] || 'N/I';
      thirdPartyNotification.messageId = body['message_id'] || 'N/I';
      thirdPartyNotification.messageType = body['message_type'] || 'N/I';
      thirdPartyNotification.messageState = body['message_state'] || 'N/I';
      thirdPartyNotification.waid = body['waid'] || 'N/I';
      thirdPartyNotification.eventTime = body['event_time'] || 'N/I';
      thirdPartyNotification.messageCustomId = body['message_custom_id'] || 'N/I';
      const notification = await this.getNotificationById(id);
      const notificationReceivedEvent = new NotificationReceived(new Date(), { id, providerData: thirdPartyNotification, ourData: notification, received: true }, { provider });
      await publish(notificationReceivedEvent);
      return notificationReceivedEvent;
    }
    return false;
  }

  public async createAttentionStatisticsEmailNotification(
    email: string,
    type: NotificationType,
    commerceId: string,
    template: string,
    commerce: string,
    tag: string,
    from: string,
    to: string,
    currentAttentionNumber: number|string,
    pastAttentionNumber: number|string,
    currentAttentionAvgTime: number|string,
    pastAttentionAvgTime: number|string,
    currentAttentionDailyAvg: number|string,
    pastAttentionDailyAvg: number|string,
    currentCSAT: number|string,
    pastCSAT: number|string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.commerceId = commerceId;
    let metadata;
    try {
      const templateData = {
        commerce,
        tag,
        from,
        to,
        currentAttentionNumber,
        pastAttentionNumber,
        currentAttentionAvgTime,
        pastAttentionAvgTime,
        currentAttentionDailyAvg,
        pastAttentionDailyAvg,
        currentCSAT,
        pastCSAT
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email, process.env.EMAIL_SOURCE]
        },
        Template: template,
        TemplateData: JSON.stringify(templateData)
      };
      metadata = await this.emailNotify(email, data, template);
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, { metadata });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  public async createBookingEmailNotification(
    email: string,
    type: NotificationType,
    bookingId: string,
    commerceId: string,
    queueId: string,
    template: string,
    reserveNumber: number,
    reserveDate: string,
    reserveBlock: string,
    commerce: string,
    link: string,
    logo: string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.bookingId = bookingId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    let metadata;
    try {
      const templateData = {
        reserveNumber,
        reserveBlock,
        reserveDate,
        commerce,
        link,
        logo
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email]
        },
        Template: template,
        TemplateData: JSON.stringify(templateData)
      };
      metadata = await this.emailNotify(email, data, template);
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, { metadata });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  public async createWaitlistEmailNotification(
    email: string,
    type: NotificationType,
    waitlistId: string,
    commerceId: string,
    queueId: string,
    template: string,
    waitlistDate: string,
    waitlistBlock: string,
    commerce: string,
    link: string,
    logo: string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.waitlistId = waitlistId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    let metadata;
    try {
      const templateData = {
        waitlistDate,
        waitlistBlock,
        commerce,
        link,
        logo
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email]
        },
        Template: template,
        TemplateData: JSON.stringify(templateData)
      };
      metadata = await this.emailNotify(email, data, template);
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, { metadata });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  public async createBookingWhatsappNotification(
    phone: string,
    userId: string,
    message: string,
    type: NotificationType,
    bookingId: string,
    commerceId: string,
    queueId: string,
    servicePhoneNumber: string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.WHATSAPP;
    notification.type = type;
    notification.receiver = userId;
    notification.bookingId = bookingId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    notification.provider = this.whatsappProvider;
    const notificationCreated = await this.notificationRepository.create(notification);
    const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated);
    publish(notificationCreatedEvent);
    let metadata;
    try {
      metadata = await this.whatsappNotify(phone, message, notificationCreated.id, commerceId, servicePhoneNumber);
      if (this.whatsappProvider === NotificationProvider.TWILIO) {
        notificationCreated.twilioId = metadata['sid'];
        notificationCreated.providerId = metadata['sid'];
      }
      if (this.whatsappProvider === NotificationProvider.WHATSGW) {
        notificationCreated.twilioId = 'N/A';
        notificationCreated.providerId = metadata['message_id'] || 'N/I';
      }
    } catch (error) {
      notificationCreated.comment = error.message;
    }
    return await this.update(notificationCreated);
  }

  public async createWaitlistWhatsappNotification(
    phone: string,
    userId: string,
    message: string,
    type: NotificationType,
    waitlistId: string,
    commerceId: string,
    queueId: string
  ){
    let notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.WHATSAPP;
    notification.type = type;
    notification.receiver = userId;
    notification.waitlistId = waitlistId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    notification.provider = this.whatsappProvider;
    const notificationCreated = await this.notificationRepository.create(notification);
    const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated);
    publish(notificationCreatedEvent);
    let metadata;
    try {
      metadata = await this.whatsappNotify(phone, message, notificationCreated.id, commerceId);
      if (this.whatsappProvider === NotificationProvider.TWILIO) {
        notificationCreated.twilioId = metadata['sid'];
        notificationCreated.providerId = metadata['sid'];
      }
      if (this.whatsappProvider === NotificationProvider.WHATSGW) {
        notificationCreated.twilioId = 'N/A';
        notificationCreated.providerId = metadata['message_id'] || 'N/I';
      }
    } catch (error) {
      notificationCreated.comment = error.message;
    }
    return await this.update(notificationCreated);
  }
}