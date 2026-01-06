import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { Attention } from '../attention/model/attention.entity';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';

import NotificationCreated from './events/NotificationCreated';
import NotificationReceived from './events/NotificationReceived';
import NotificationUpdated from './events/NotificationUpdated';
import { NotificationClient } from './infrastructure/notification-client';
import { clientStrategy } from './infrastructure/notification-client-strategy';
import { EmailInputDto, RawEmailInputDto, Attachment } from './model/email-input.dto';
import { NotificationChannel } from './model/notification-channel.enum';
import { NotificationProvider } from './model/notification-provider';
import { NotificationThirdPartyDto } from './model/notification-third-party.dto';
import { NotificationType } from './model/notification-type.enum';
import { Notification } from './model/notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository = getRepository(Notification),
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    @Inject(forwardRef(() => clientStrategy(NotificationChannel.WHATSAPP)))
    private whatsappNotificationClient: NotificationClient,
    @Inject(forwardRef(() => clientStrategy(NotificationChannel.EMAIL)))
    private emailNotificationClient: NotificationClient,
    @Inject(forwardRef(() => clientStrategy(NotificationChannel.SMS)))
    private smsNotificationClient: NotificationClient,
    @Inject(GcpLoggerService)
    private readonly logger: GcpLoggerService
  ) {
    this.logger.setContext('NotificationService');
  }

  private readonly whatsappProvider = process.env.WHATSAPP_NOTIFICATION_PROVIDER || 'N/I';
  private readonly emailProvider = process.env.EMAIL_NOTIFICATION_PROVIDER || 'N/I';
  private readonly smsProvider = process.env.SMS_NOTIFICATION_PROVIDER || 'TWILIO';

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
  ) {
    // Validate and normalize phone number before processing
    if (!phone || (typeof phone !== 'string' && typeof phone !== 'number')) {
      this.logger.logError(
        new Error(`Invalid phone number provided: ${phone} (type: ${typeof phone})`),
        undefined,
        { userId, attentionId, commerceId, type, operation: 'createWhatsappNotification' }
      );
      throw new Error(`Invalid phone number: ${phone}`);
    }

    const notification = new Notification();
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
      this.logger.log(`[NotificationService] createWhatsappNotification called:`, {
        notificationId: notificationCreated.id,
        to: phone,
        phoneType: typeof phone,
        from: servicePhoneNumber || 'default',
        provider: this.whatsappProvider,
        commerceId,
        type,
      });
      metadata = await this.whatsappNotify(
        String(phone), // Ensure it's a string
        message,
        notificationCreated.id,
        commerceId,
        servicePhoneNumber
      );
      this.logger.log(`[NotificationService] WhatsApp metadata received:`, {
        notificationId: notificationCreated.id,
        metadata: JSON.stringify(metadata),
        provider: this.whatsappProvider,
      });
      if (this.whatsappProvider === NotificationProvider.TWILIO) {
        notificationCreated.twilioId = metadata['sid'];
        notificationCreated.providerId = metadata['sid'];
      }
      if (this.whatsappProvider === NotificationProvider.WHATSGW) {
        notificationCreated.twilioId = 'N/A';
        notificationCreated.providerId = metadata['message_id'] || metadata['messageId'] || 'N/I';
        // Log the full response for debugging
        this.logger.log(`[NotificationService] WhatsGW response details:`, {
          notificationId: notificationCreated.id,
          fullResponse: JSON.stringify(metadata),
          messageId: metadata['message_id'] || metadata['messageId'],
        });
      }
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        notificationId: notificationCreated.id,
        to: phone,
        from: servicePhoneNumber || 'default',
        operation: 'createWhatsappNotification',
      });
      notificationCreated.comment = error.message;
      // Re-throw the error so calling code can handle it properly
      throw error;
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
  ) {
    const notification = new Notification();
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
        collaboratorName,
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email],
        },
        Template: template,
        TemplateData: JSON.stringify(templateData),
      };
      metadata = await this.emailNotify(email, data, template);
      delete metadata.raw;
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, {
        metadata,
      });
      publish(notificationCreatedEvent);
      this.logger.info('Email notification created successfully', {
        notificationId: notificationCreated.id,
        email,
        type,
        commerceId,
        queueId,
        template,
        provider: this.emailProvider,
        providerId: notificationCreated.providerId,
      });
    } catch (error) {
      notification.comment = error.message;
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        email,
        type,
        commerceId,
        queueId,
        template,
        provider: this.emailProvider,
        operation: 'createEmailNotification',
      });
    }
  }

  public async whatsappNotify(
    phone: string,
    message: string,
    notificationId: string,
    commerceId: string,
    servicePhoneNumber?: string
  ): Promise<string> {
    // Normalize phone number: ensure it's a string and remove any non-digit characters except +
    let normalizedPhone: string;
    if (typeof phone === 'number') {
      normalizedPhone = String(phone);
    } else if (typeof phone === 'string') {
      normalizedPhone = phone.trim();
    } else {
      this.logger.logError(
        new Error(`Invalid phone number type: ${typeof phone}, value: ${phone}`),
        undefined,
        { notificationId, commerceId, operation: 'whatsappNotify' }
      );
      throw new Error(`Invalid phone number: ${phone}`);
    }

    // Remove any non-digit characters except + at the start
    normalizedPhone = normalizedPhone.replace(/[^\d+]/g, '');
    // Ensure + is only at the start if present
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone.slice(1).replace(/[^\d]/g, '');
    } else {
      normalizedPhone = normalizedPhone.replace(/[^\d]/g, '');
    }

    // Detect and fix repeated digit patterns (like "55555555555555555555")
    // This happens when phone numbers are incorrectly concatenated
    // Pattern: if we have more than 5 consecutive identical digits, it's likely an error
    const repeatedDigitPattern = /(\d)\1{4,}/g;
    if (repeatedDigitPattern.test(normalizedPhone)) {
      this.logger.log(`[NotificationService] Detected repeated digit pattern in phone: ${normalizedPhone}`, {
        originalPhone: phone,
        notificationId,
        commerceId,
      });

      // Try to fix: detect the pattern and extract the real phone number
      // Common pattern: many repeated digits (usually "5") followed by the actual number
      // Example: "5555555555555555555511919931589" -> should be "569119931589" (56 = Chile code)
      let fixedPhone = normalizedPhone;

      // Find the longest sequence of repeated digits at the start
      const startMatch = normalizedPhone.match(/^(\d)\1+/);
      if (startMatch && startMatch[0].length > 5) {
        const repeatedDigit = startMatch[1];
        const repeatedLength = startMatch[0].length;
        const remainingNumber = normalizedPhone.slice(repeatedLength);

        // If we have a remaining number that looks valid (8+ digits)
        if (remainingNumber.length >= 8) {
          // Special case: if repeated digit is "5" and remaining starts with "1",
          // it's likely the country code "56" got corrupted to many "5"s
          // and the "6" was lost or merged with the number
          if (repeatedDigit === '5' && remainingNumber.length >= 10) {
            // The pattern suggests: many "5"s + number starting with "1"
            // Most likely the original was "56" + number, where "6" got lost
            // Try removing the leading "1" from remaining (it might be the corrupted "6")
            const candidateWithoutLeading1 = '56' + remainingNumber.slice(1);
            const candidateWithLeading1 = '56' + remainingNumber;

            // Prefer the one that results in a more standard length (10-15 digits)
            // and looks more like a valid phone number
            if (candidateWithoutLeading1.length >= 10 && candidateWithoutLeading1.length <= 15) {
              fixedPhone = candidateWithoutLeading1;
            } else if (candidateWithLeading1.length >= 10 && candidateWithLeading1.length <= 15) {
              fixedPhone = candidateWithLeading1;
            } else {
              // Fallback: just use "56" + remaining (remove leading "1" if it makes sense)
              fixedPhone = remainingNumber.length > 10 ? '56' + remainingNumber.slice(1) : '56' + remainingNumber;
            }

            this.logger.log(`[NotificationService] Fixed phone (Chile pattern with 5s): ${normalizedPhone} -> ${fixedPhone}`, {
              originalPhone: phone,
              notificationId,
              commerceId,
              remainingNumber,
            });
            normalizedPhone = fixedPhone;
          } else {
            // For other cases, just remove excessive repetition
            // Keep only 2 occurrences of the repeated digit (likely country code)
            fixedPhone = repeatedDigit + repeatedDigit + remainingNumber;
            if (fixedPhone.length >= 8 && fixedPhone.length <= 15) {
              this.logger.log(`[NotificationService] Fixed phone (removed repeats): ${normalizedPhone} -> ${fixedPhone}`, {
                originalPhone: phone,
                notificationId,
                commerceId,
              });
              normalizedPhone = fixedPhone;
            }
          }
        }
      }
    }

    // Final validation: phone should be between 8 and 15 digits (international standard)
    // Remove leading + for length check
    const phoneDigits = normalizedPhone.replace(/^\+/, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      this.logger.logError(
        new Error(`Phone number has invalid length: ${phoneDigits.length} digits. Phone: ${normalizedPhone}`),
        undefined,
        { originalPhone: phone, normalizedPhone, notificationId, commerceId, operation: 'whatsappNotify' }
      );
      // Don't throw, but log the issue - let the API handle the validation
    }

    this.logger.log(`[NotificationService] Sending WhatsApp notification:`, {
      originalPhone: phone,
      normalizedPhone: normalizedPhone,
      phoneType: typeof phone,
      from: servicePhoneNumber || 'default',
      notificationId,
      commerceId,
      messageLength: message.length,
    });
    try {
      const response = await this.whatsappNotificationClient.sendMessage(
        message,
        normalizedPhone,
        notificationId,
        servicePhoneNumber
      );
      this.logger.log(`[NotificationService] WhatsApp notification sent successfully:`, {
        notificationId,
        response: JSON.stringify(response),
      });
      return response;
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        notificationId,
        originalPhone: phone,
        normalizedPhone: normalizedPhone,
        from: servicePhoneNumber || 'default',
        operation: 'whatsappNotify',
      });
      throw error;
    }
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
    html: string
  ) {
    const notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.bookingId = bookingId;
    notification.commerceId = commerceId;
    let metadata;
    try {
      metadata = await this.rawEmailNotify({
        from,
        to,
        subject,
        html,
        attachments,
      });
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, {
        metadata,
      });
      publish(notificationCreatedEvent);
      this.logger.info('Raw email notification created successfully (booking)', {
        notificationId: notificationCreated.id,
        bookingId,
        commerceId,
        type,
        toCount: to.length,
        provider: this.emailProvider,
        providerId: notificationCreated.providerId,
      });
    } catch (error) {
      notification.comment = error.message;
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        bookingId,
        commerceId,
        type,
        operation: 'createBookingRawEmailNotification',
      });
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
    html: string
  ) {
    const notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.EMAIL;
    notification.type = type;
    notification.attentionId = attentionId;
    notification.commerceId = commerceId;
    let metadata;
    try {
      metadata = await this.rawEmailNotify({
        from,
        to,
        subject,
        html,
        attachments,
      });
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, {
        metadata,
      });
      publish(notificationCreatedEvent);
      this.logger.info('Raw email notification created successfully (attention)', {
        notificationId: notificationCreated.id,
        attentionId,
        commerceId,
        type,
        toCount: to.length,
        provider: this.emailProvider,
        providerId: notificationCreated.providerId,
      });
    } catch (error) {
      notification.comment = error.message;
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        attentionId,
        commerceId,
        type,
        operation: 'createAttentionRawEmailNotification',
      });
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
  ) {
    const notification = new Notification();
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
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email],
        },
        Template: template,
        TemplateData: JSON.stringify(templateData),
      };
      metadata = await this.emailNotify(email, data, template);
      delete metadata.raw;
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, {
        metadata,
      });
      publish(notificationCreatedEvent);
    } catch (error) {
      notification.comment = error.message;
    }
  }

  /**
   * Crear notificación genérica (para uso interno)
   */
  public async createNotification(notificationData: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    commerceId?: string;
    attentionId?: string;
    bookingId?: string;
    queueId?: string;
  }): Promise<Notification> {
    const notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.APP;
    notification.type = notificationData.type;
    notification.receiver = notificationData.userId;
    notification.title = notificationData.title;
    notification.message = notificationData.message;
    notification.data = notificationData.data;
    notification.commerceId = notificationData.commerceId;
    notification.attentionId = notificationData.attentionId;
    notification.bookingId = notificationData.bookingId;
    notification.queueId = notificationData.queueId;
    notification.provider = 'internal';

    const createdNotification = await this.notificationRepository.create(notification);
    const notificationCreatedEvent = new NotificationCreated(new Date(), createdNotification);
    publish(notificationCreatedEvent);
    return createdNotification;
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
      const notificationReceivedEvent = new NotificationReceived(
        new Date(),
        { id, providerData: thirdPartyNotification, ourData: notification, received: true },
        { provider }
      );
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
    currentAttentionNumber: number | string,
    pastAttentionNumber: number | string,
    currentAttentionAvgTime: number | string,
    pastAttentionAvgTime: number | string,
    currentAttentionDailyAvg: number | string,
    pastAttentionDailyAvg: number | string,
    currentCSAT: number | string,
    pastCSAT: number | string
  ) {
    const notification = new Notification();
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
        pastCSAT,
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email, process.env.EMAIL_SOURCE],
        },
        Template: template,
        TemplateData: JSON.stringify(templateData),
      };
      metadata = await this.emailNotify(email, data, template);
      delete metadata.raw;
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, {
        metadata,
      });
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
  ) {
    const notification = new Notification();
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
        logo,
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email],
        },
        Template: template,
        TemplateData: JSON.stringify(templateData),
      };
      metadata = await this.emailNotify(email, data, template);
      delete metadata.raw;
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, {
        metadata,
      });
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
  ) {
    const notification = new Notification();
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
        logo,
      };
      const data: EmailInputDto = {
        Source: process.env.EMAIL_SOURCE,
        Destination: {
          ToAddresses: [email],
        },
        Template: template,
        TemplateData: JSON.stringify(templateData),
      };
      metadata = await this.emailNotify(email, data, template);
      delete metadata.raw;
      if (this.emailProvider === NotificationProvider.AWS) {
        notification.twilioId = 'N/A';
        notification.providerId = metadata['MessageId'] || 'N/I';
      }
      notification.provider = this.emailProvider;
      const notificationCreated = await this.notificationRepository.create(notification);
      const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated, {
        metadata,
      });
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
  ) {
    // Validate and normalize phone number before processing
    if (!phone || (typeof phone !== 'string' && typeof phone !== 'number')) {
      this.logger.logError(
        new Error(`Invalid phone number provided: ${phone} (type: ${typeof phone})`),
        undefined,
        { userId, bookingId, commerceId, type, operation: 'createBookingWhatsappNotification' }
      );
      throw new Error(`Invalid phone number: ${phone}`);
    }

    const notification = new Notification();
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
      this.logger.log(`[NotificationService] createBookingWhatsappNotification called:`, {
        notificationId: notificationCreated.id,
        to: phone,
        phoneType: typeof phone,
        from: servicePhoneNumber || 'default',
        provider: this.whatsappProvider,
        commerceId,
        bookingId,
        type,
      });
      metadata = await this.whatsappNotify(
        String(phone), // Ensure it's a string
        message,
        notificationCreated.id,
        commerceId,
        servicePhoneNumber
      );
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
  ) {
    const notification = new Notification();
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
    // Validate and normalize phone number
    if (!phone || (typeof phone !== 'string' && typeof phone !== 'number')) {
      throw new Error(`Invalid phone number: ${phone} (type: ${typeof phone})`);
    }

    let metadata;
    try {
      this.logger.log(`[NotificationService] createWaitlistWhatsappNotification called:`, {
        notificationId: notificationCreated.id,
        waitlistId,
        commerceId,
        to: phone,
        phoneType: typeof phone,
        provider: this.whatsappProvider,
        type,
      });
      metadata = await this.whatsappNotify(String(phone), message, notificationCreated.id, commerceId);
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

  public async sendPreprontuarioWhatsappReminder(
    clientId: string,
    commerceId: string,
    email: string,
    phone: string,
    attentionLink?: string,
    attentionId?: string,
    queueId?: string,
  ): Promise<Notification> {
    const notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.WHATSAPP;
    notification.type = NotificationType.PREPRONTUARIO_REMINDER;
    notification.receiver = clientId;
    notification.commerceId = commerceId;
    notification.provider = this.whatsappProvider;

    // Store attention and queue context if provided
    if (attentionId) {
      notification.attentionId = attentionId;
    }
    if (queueId) {
      notification.queueId = queueId;
    }

    // Create notification and publish event to CQRS event store
    const notificationCreated = await this.notificationRepository.create(notification);
    const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated);
    publish(notificationCreatedEvent);

    // Build attention link if not provided
    let preprontuarioLink = attentionLink;

    // If no link provided, try to build it from attentionId and queueId
    if (!preprontuarioLink) {
      // If we have queueId and attentionId, build link directly
      if (queueId && attentionId) {
        const frontendUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:5173';
        preprontuarioLink = `${frontendUrl}/interno/fila/${queueId}/atencion/${attentionId}/`;
      }
      // If we only have attentionId, fetch attention to get queueId
      else if (attentionId) {
        try {
          const attention = await this.attentionRepository.findById(attentionId);
          if (attention && attention.queueId) {
            const frontendUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:5173';
            preprontuarioLink = `${frontendUrl}/interno/fila/${attention.queueId}/atencion/${attentionId}/`;
          }
        } catch (error) {
          this.logger.logError(
            error instanceof Error ? error : new Error(String(error)),
            undefined,
            {
              attentionId,
              operation: 'buildAttentionLink',
            }
          );
        }
      }
    }

    // If still no link, throw error
    if (!preprontuarioLink) {
      throw new Error('attentionLink is required, or provide attentionId (and optionally queueId) to generate link automatically');
    }

    // Create WhatsApp message with instructions
    const message = `👋 *¡Hola!*

📋 Para completar tu *atención*, necesitas llenar el preprontuario.

🔗 *Por favor ingresa al siguiente enlace:*
${preprontuarioLink}

📧 *Email de la atención:* ${email}

⚡ Es importante completar esta información para brindar la mejor atención posible.

✅ *¡Gracias por tu colaboración!* 🙏`;

    let metadata;
    try {
      // Validate and normalize phone number
      if (!phone || (typeof phone !== 'string' && typeof phone !== 'number')) {
        throw new Error(`Invalid phone number: ${phone} (type: ${typeof phone})`);
      }

      this.logger.log(`[NotificationService] sendPreprontuarioWhatsappReminder called:`, {
        notificationId: notificationCreated.id,
        clientId,
        commerceId,
        attentionId: attentionId || 'N/A',
        queueId: queueId || 'N/A',
        to: phone,
        phoneType: typeof phone,
        provider: this.whatsappProvider,
        hasAttentionLink: !!attentionLink,
      });

      metadata = await this.whatsappNotify(String(phone), message, notificationCreated.id, commerceId);

      if (this.whatsappProvider === NotificationProvider.TWILIO) {
        notificationCreated.twilioId = metadata['sid'];
        notificationCreated.providerId = metadata['sid'];
      }
      if (this.whatsappProvider === NotificationProvider.WHATSGW) {
        notificationCreated.twilioId = 'N/A';
        notificationCreated.providerId = metadata['message_id'] || 'N/I';
      }

      this.logger.log(`[NotificationService] Preprontuario WhatsApp sent successfully:`, {
        notificationId: notificationCreated.id,
        providerId: notificationCreated.providerId,
      });
    } catch (error) {
      notificationCreated.comment = error.message;
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        undefined,
        {
          notificationId: notificationCreated.id,
          clientId,
          commerceId,
          operation: 'sendPreprontuarioWhatsappReminder',
        }
      );
      throw error;
    }

    // Update notification with provider metadata and publish update event to CQRS event store
    return await this.update(notificationCreated);
  }

  public async sendAgreementWhatsappReminder(
    clientId: string,
    commerceId: string,
    email: string,
    phone: string,
  ): Promise<Notification> {
    const notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.WHATSAPP;
    notification.type = NotificationType.AGREEMENT_REMINDER;
    notification.receiver = clientId;
    notification.commerceId = commerceId;
    notification.provider = this.whatsappProvider;

    const notificationCreated = await this.notificationRepository.create(notification);
    const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated);
    publish(notificationCreatedEvent);

    // Generate agreement link
    const agreementLink = `${process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:5173'}/agreement/${commerceId}/${clientId}?email=${encodeURIComponent(email)}`;

    // Create WhatsApp message
    const message = `👋 *¡Hola!*

📄 Para completar tu proceso, necesitas *aceptar el convenio de atención*.

🔗 *Por favor ingresa al siguiente enlace:*
${agreementLink}

📧 *Email del convenio:* ${email}

📋 Este paso es necesario para proceder con tu atención.

✅ *¡Gracias por tu tiempo!* 🙏`;

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
      throw error;
    }

    return await this.update(notificationCreated);
  }

  /**
   * Cria e envia notificação SMS
   */
  public async createSmsNotification(
    phone: string,
    userId: string,
    message: string,
    type: NotificationType,
    commerceId: string,
    attentionId?: string,
    queueId?: string
  ): Promise<Notification> {
    // Validate and normalize phone number before processing
    if (!phone || (typeof phone !== 'string' && typeof phone !== 'number')) {
      this.logger.logError(
        new Error(`Invalid phone number provided: ${phone} (type: ${typeof phone})`),
        undefined,
        { userId, attentionId, commerceId, type, operation: 'createSmsNotification' }
      );
      throw new Error(`Invalid phone number: ${phone}`);
    }

    const notification = new Notification();
    notification.createdAt = new Date();
    notification.channel = NotificationChannel.SMS;
    notification.type = type;
    notification.receiver = userId;
    notification.attentionId = attentionId;
    notification.commerceId = commerceId;
    notification.queueId = queueId;
    notification.provider = this.smsProvider;
    const notificationCreated = await this.notificationRepository.create(notification);
    const notificationCreatedEvent = new NotificationCreated(new Date(), notificationCreated);
    publish(notificationCreatedEvent);
    let metadata;
    try {
      this.logger.log(`[NotificationService] createSmsNotification called:`, {
        notificationId: notificationCreated.id,
        to: phone,
        phoneType: typeof phone,
        provider: this.smsProvider,
        commerceId,
        type,
      });
      metadata = await this.smsNotify(
        String(phone), // Ensure it's a string
        message,
        notificationCreated.id
      );
      this.logger.log(`[NotificationService] SMS metadata received:`, {
        notificationId: notificationCreated.id,
        metadata: JSON.stringify(metadata),
        provider: this.smsProvider,
      });
      if (this.smsProvider === 'TWILIO') {
        notificationCreated.twilioId = metadata['sid'];
        notificationCreated.providerId = metadata['sid'];
      }
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        notificationId: notificationCreated.id,
        to: phone,
        operation: 'createSmsNotification',
      });
      notificationCreated.comment = error.message;
    }
    return await this.update(notificationCreated);
  }

  /**
   * Envia SMS usando o cliente de notificação
   */
  public async smsNotify(
    phone: string,
    message: string,
    notificationId: string
  ): Promise<string> {
    // Normalize phone number: ensure it's a string and remove any non-digit characters except +
    let normalizedPhone: string;
    if (typeof phone === 'number') {
      normalizedPhone = String(phone);
    } else if (typeof phone === 'string') {
      normalizedPhone = phone.trim();
    } else {
      this.logger.logError(
        new Error(`Invalid phone number type: ${typeof phone}, value: ${phone}`),
        undefined,
        { notificationId, operation: 'smsNotify' }
      );
      throw new Error(`Invalid phone number: ${phone}`);
    }

    // Remove any non-digit characters except + at the start
    normalizedPhone = normalizedPhone.replace(/[^\d+]/g, '');
    // Ensure + is only at the start if present
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone.slice(1).replace(/[^\d]/g, '');
    } else {
      normalizedPhone = normalizedPhone.replace(/[^\d]/g, '');
    }

    // Final validation: phone should be between 8 and 15 digits (international standard)
    const phoneDigits = normalizedPhone.replace(/^\+/, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      this.logger.logError(
        new Error(`Phone number has invalid length: ${phoneDigits.length} digits. Phone: ${normalizedPhone}`),
        undefined,
        { originalPhone: phone, normalizedPhone, notificationId, operation: 'smsNotify' }
      );
      // Don't throw, but log the issue - let the API handle the validation
    }

    this.logger.log(`[NotificationService] Sending SMS notification:`, {
      originalPhone: phone,
      normalizedPhone: normalizedPhone,
      phoneType: typeof phone,
      notificationId,
      messageLength: message.length,
    });
    try {
      // Check if SMS client has sendSms method
      if (this.smsNotificationClient && typeof this.smsNotificationClient.sendSms === 'function') {
        const response = await this.smsNotificationClient.sendSms(
          message,
          normalizedPhone,
          notificationId
        );
        this.logger.log(`[NotificationService] SMS notification sent successfully:`, {
          notificationId,
          response: JSON.stringify(response),
        });
        return response;
      } else {
        throw new Error('SMS client does not support sendSms method');
      }
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        notificationId,
        originalPhone: phone,
        normalizedPhone: normalizedPhone,
        operation: 'smsNotify',
      });
      throw error;
    }
  }
}
