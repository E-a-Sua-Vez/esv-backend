import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Booking } from 'src/booking/model/booking.entity';
import { NotificationTemplate } from 'src/notification/model/notification-template.enum';

import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { CommerceLogoService } from '../commerce-logo/commerce-logo.service';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { FeatureToggle } from '../feature-toggle/model/feature-toggle.entity';
import { FeatureToggleName } from '../feature-toggle/model/feature-toggle.enum';
import { NotificationType } from '../notification/model/notification-type.enum';
import { NotificationService } from '../notification/notification.service';
import { QueueService } from '../queue/queue.service';
import { User } from '../user/model/user.entity';

import { WaitlistDefaultBuilder } from './builders/waitlist-default';
import { WaitlistDetailsDto } from './dto/waitlist-details.dto';
import WaitlistUpdated from './events/WaitlistUpdated';
import { WaitlistChannel } from './model/waitlist-channel.enum';
import { WaitlistStatus } from './model/waitlist-status.enum';
import { WaitlistType } from './model/waitlist-type.enum';
import { Block, Waitlist } from './model/waitlist.entity';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(Waitlist)
    private waitlistRepository = getRepository(Waitlist),
    private queueService: QueueService,
    private notificationService: NotificationService,
    private featureToggleService: FeatureToggleService,
    private commerceService: CommerceService,
    private commerceLogoService: CommerceLogoService,
    private waitlistDefaultBuilder: WaitlistDefaultBuilder,
    private clientService: ClientService
  ) {}

  /**
   * Get commerce logo S3 signed URL for email use
   */
  private async getCommerceLogoForEmail(commerceId: string): Promise<string> {
    const frontendBaseUrl =
      process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:5173';
    const defaultLogoUrl = `${frontendBaseUrl}/images/hub/logo/hub-color-transparente.png`;
    try {
      // Try to get S3 signed URL (expires in 7 days for emails)
      const signedUrl = await this.commerceLogoService.getCommerceLogoS3SignedUrl(commerceId, 60 * 60 * 24 * 7);
      if (signedUrl) {
        return signedUrl;
      }
      // Fallback to default logo if no logo exists
      return defaultLogoUrl;
    } catch (error) {
      return defaultLogoUrl;
    }
  }

  public async getWaitlistById(id: string): Promise<Waitlist> {
    return await this.waitlistRepository.findById(id);
  }

  public async createWaitlist(
    queueId: string,
    channel: string = WaitlistChannel.QR,
    date: string,
    user?: User,
    clientId?: string
  ): Promise<Waitlist> {
    const queue = await this.queueService.getQueueById(queueId);
    if (clientId !== undefined) {
      const client = await this.clientService.getClientById(clientId);
      if (client && client.id) {
        user = {
          ...user,
          email: client.email || user.email,
          phone: client.phone || user.phone,
          name: client.name || user.name,
          lastName: client.lastName || user.lastName,
          personalInfo: client.personalInfo || user.personalInfo,
          idNumber: client.idNumber || user.idNumber,
        };
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
      } else {
        throw new HttpException(
          `Error creando lista de espera: Cliente no existe ${clientId}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
    const waitlistCreated = await this.waitlistDefaultBuilder.create(
      date,
      queue,
      channel,
      user,
      clientId
    );
    return waitlistCreated;
  }

  public async getWaitlistsByDate(date: string): Promise<Waitlist[]> {
    return await this.waitlistRepository.whereEqualTo('date', date).find();
  }

  public async getWaitlistsByQueueAndDate(queueId: string, date: string): Promise<Waitlist[]> {
    return await this.waitlistRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .find();
  }

  public async getPendingWaitlistsByQueueAndDate(
    queueId: string,
    date: string
  ): Promise<Waitlist[]> {
    const waitlists = await this.waitlistRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereEqualTo('status', WaitlistStatus.PENDING)
      .find();

    // Filter out waitlists that are already processed or have a bookingId
    // This prevents race conditions where a waitlist was processed but status wasn't updated yet
    return waitlists.filter(waitlist =>
      !waitlist.processed && !waitlist.bookingId
    );
  }

  public async getPendingWaitlistsByDate(date: string): Promise<Waitlist[]> {
    return await this.waitlistRepository
      .whereEqualTo('date', date)
      .whereIn('status', [WaitlistStatus.PENDING])
      .find();
  }

  featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  public async waitlistEmail(waitlist: Waitlist, block?: Block): Promise<Waitlist[]> {
    const waitlistCommerce = await this.commerceService.getCommerceById(waitlist.commerceId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      waitlist.commerceId,
      FeatureToggleName.EMAIL
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'email-waitlist')) {
      toNotify.push(waitlist);
    }
    const notified = [];
    const commerceLanguage = waitlistCommerce.localeInfo.language;
    toNotify.forEach(async waitlist => {
      if (waitlist !== undefined && waitlist.type === WaitlistType.STANDARD) {
        if (waitlist.user.email) {
          const template = `${NotificationTemplate.WAITLIST}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/waitlist/${waitlist.id}/${block.number}`;
          const logo = await this.getCommerceLogoForEmail(waitlist.commerceId);
          const waitlistDate = waitlist.date;
          const waitlistblock = `${block.hourFrom} - ${block.hourTo}`;
          const commerce = waitlistCommerce.name;
          await this.notificationService.createWaitlistEmailNotification(
            waitlist.user.email,
            NotificationType.WAITLIST,
            waitlist.id,
            waitlist.commerceId,
            waitlist.queueId,
            template,
            waitlistDate,
            waitlistblock,
            commerce,
            link,
            logo
          );
          notified.push(waitlist);
        }
      }
    });
    return notified;
  }

  public async waitlistWhatsapp(waitlist: Waitlist, block: Block): Promise<Waitlist[]> {
    const waitlistCommerce = await this.commerceService.getCommerceById(waitlist.commerceId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      waitlist.commerceId,
      FeatureToggleName.WHATSAPP
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'whatsapp-waitlist')) {
      toNotify.push(waitlist);
    }
    const notified = [];
    let message = '';
    let type;
    toNotify.forEach(async waitlist => {
      if (waitlist !== undefined && waitlist.type === WaitlistType.STANDARD) {
        const user = waitlist.user;
        if (user.notificationOn) {
          type = NotificationType.WAITLIST;
          const link = `${process.env.BACKEND_URL}/interno/waitlist/${waitlist.id}/${block.number}`;
          message =
            waitlistCommerce.localeInfo.language === 'pt'
              ? `Olá, a espera acabou! Está disponível uma hora em *${waitlistCommerce.name}* para o día *${waitlist.date}* as *${block.hourFrom}*.

Quer confirmar? Confirme sua reserva no próximo link:

${link}

Obrigado!`
              : `Hola, ¡terminó la espera! Está disponible una hora en *${waitlistCommerce.name}* para el día *${waitlist.date}* a las *${block.hourFrom}*.

¿La quieres? Confirma tu reserva en el siguiente link:

${link}

¡Muchas gracias!
`;
          await this.notificationService.createWaitlistWhatsappNotification(
            user.phone,
            waitlist.id,
            message,
            type,
            waitlist.id,
            waitlist.commerceId,
            waitlist.queueId
          );
          notified.push(waitlist);
        }
      }
    });
    return notified;
  }

  public async getWaitlistDetails(id: string): Promise<WaitlistDetailsDto> {
    try {
      const waitlist = await this.getWaitlistById(id);
      const waitlistDetailsDto: WaitlistDetailsDto = new WaitlistDetailsDto();

      waitlistDetailsDto.id = waitlist.id;
      waitlistDetailsDto.commerceId = waitlist.commerceId;
      waitlistDetailsDto.createdAt = waitlist.createdAt;
      waitlistDetailsDto.date = waitlist.date;
      waitlistDetailsDto.queueId = waitlist.queueId;
      waitlistDetailsDto.status = waitlist.status;
      waitlistDetailsDto.userId = waitlist.userId;
      waitlistDetailsDto.comment = waitlist.comment;
      waitlistDetailsDto.type = waitlist.type;
      waitlistDetailsDto.channel = waitlist.channel;
      waitlistDetailsDto.user = waitlist.user;
      waitlistDetailsDto.processedAt = waitlist.processedAt;
      waitlistDetailsDto.processed = waitlist.processed;
      waitlistDetailsDto.cancelledAt = waitlist.cancelledAt;
      waitlistDetailsDto.cancelled = waitlist.cancelled;
      waitlistDetailsDto.bookingId = waitlist.bookingId;
      if (waitlist.queueId) {
        waitlistDetailsDto.queue = await this.queueService.getQueueById(waitlist.queueId);
        waitlistDetailsDto.commerce = await this.commerceService.getCommerceById(
          waitlistDetailsDto.queue.commerceId
        );
        delete waitlistDetailsDto.commerce.queues;
      }
      return waitlistDetailsDto;
    } catch (error) {
      throw `Hubo un problema al obtener detalles de la reserva: ${error.message}`;
    }
  }

  public async update(user: string, waitlist: Waitlist): Promise<Waitlist> {
    const waitlistUpdated = await this.waitlistRepository.update(waitlist);
    const waitlistUpdatedEvent = new WaitlistUpdated(new Date(), waitlistUpdated, { user });
    publish(waitlistUpdatedEvent);
    return waitlistUpdated;
  }

  public async notifyWaitListFormCancelledBooking(booking: Booking): Promise<any> {
    const waitlists = await this.getPendingWaitlistsByQueueAndDate(booking.queueId, booking.date);
    if (waitlists && waitlists.length >= 0) {
      for (let i = 0; i < waitlists.length; i++) {
        const waitlist = waitlists[i];
        if (waitlist) {
          // Double-check waitlist hasn't been processed since query (race condition mitigation)
          if (waitlist.processed || waitlist.bookingId) {
            continue; // Skip already processed waitlists
          }
          await this.waitlistWhatsapp(waitlist, booking.block);
          await this.waitlistEmail(waitlist, booking.block);
        }
      }
    }
  }
}
