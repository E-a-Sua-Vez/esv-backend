import { Booking } from './model/booking.entity';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { QueueService } from '../queue/queue.service';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/model/notification-type.enum';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { FeatureToggleName } from '../feature-toggle/model/feature-toggle.enum';
import { FeatureToggle } from '../feature-toggle/model/feature-toggle.entity';
import { BookingType } from './model/booking-type.enum';
import { BookingChannel } from './model/booking-channel.enum';
import { CommerceService } from '../commerce/commerce.service';
import { User } from '../user/model/user.entity';
import { publish } from 'ett-events-lib';
import { NotificationTemplate } from 'src/notification/model/notification-template.enum';
import { BookingDefaultBuilder } from './builders/booking-default';
import { BookingDetailsDto } from './dto/booking-details.dto';
import { BookingStatus } from './model/booking-status.enum';
import BookingUpdated from './events/BookingUpdated';
import { AttentionService } from 'src/attention/attention.service';
import Bottleneck from "bottleneck";
import { Attention } from 'src/attention/model/attention.entity';
import { WaitlistService } from '../waitlist/waitlist.service';
import { Waitlist } from 'src/waitlist/model/waitlist.entity';
import { WaitlistStatus } from '../waitlist/model/waitlist-status.enum';
import { Block } from '../waitlist/model/waitlist.entity';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking),
    private queueService: QueueService,
    private notificationService: NotificationService,
    private featureToggleService: FeatureToggleService,
    private commerceService: CommerceService,
    private bookingDefaultBuilder: BookingDefaultBuilder,
    private attentionService: AttentionService,
    private waitlistService: WaitlistService
  ) { }

  public async getBookingById(id: string): Promise<Booking> {
    return await this.bookingRepository.findById(id);
  }

  public async createBooking(queueId: string, channel: string = BookingChannel.QR, date: string, user?: User, block?: Block): Promise<Booking> {
    let bookingCreated;
    let queue = await this.queueService.getQueueById(queueId);
    const dateFormatted = new Date(date);
    const newDate = new Date(dateFormatted.setDate(dateFormatted.getDate()));
    const newDateFormatted = newDate.toISOString().slice(0,10);
    const booked = await this.getPendingBookingsByQueueAndDate(queueId, newDateFormatted);
    if (booked.length >= queue.limit) {
      throw new HttpException(`Limite de la fila ${queue.id} - ${queue.name} (${queue.limit}) alcanzado para la fecha ${newDateFormatted}`, HttpStatus.INTERNAL_SERVER_ERROR);
    } else {
      let bookingNumber;
      if (block && Object.keys(block).length > 0) {
        bookingNumber = block.number;
      } else {
        const dateBookings = await this.getBookingsByQueueAndDate(queueId, date);
        const amountOfBookings = dateBookings.length || 0;
        bookingNumber = amountOfBookings + 1;
      }
      const alreadyBooked = await this.getPendingBookingsByNumberAndQueueAndDate(queueId, date, bookingNumber);
      if (alreadyBooked.length > 0) {
        throw new HttpException(`Ya fue realizada una reserva en este bloque: ${bookingNumber}`, HttpStatus.INTERNAL_SERVER_ERROR);
      } else {
        bookingCreated = await this.bookingDefaultBuilder.create(bookingNumber, date, queue, channel, user, block);
        if (user.email !== undefined) {
          await this.bookingEmail(bookingCreated);
        }
        if (user.phone !== undefined) {
          await this.bookingWhatsapp(bookingCreated);
        }
      }
    }
    return bookingCreated;
  }

  public async getBookingsByDate(date: string): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('date', date)
      .orderByDescending('number')
      .find();
  }

  public async getBookingsByQueueAndDate(queueId: string, date: string): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .find();
  }

  public async getPendingBookingsByQueueAndDate(queueId: string, date: string): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereEqualTo('status', BookingStatus.PENDING)
      .find();
  }

  public async getPendingBookingsByNumberAndQueueAndDate(queueId: string, date: string, number: number): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereEqualTo('number', number)
      .whereEqualTo('status', BookingStatus.PENDING)
      .find();
  }

  public async getPendingBookingsByDate(date: string, limit: number = 100): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('date', date)
      .whereIn('status', [BookingStatus.PENDING])
      .orderByAscending('number')
      .limit(limit)
      .find();
  }

  public async getBookingsBeforeYouByDate(number: number, queueId: string, date: string): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereEqualTo('status', BookingStatus.PENDING)
      .whereLessThan('number', number)
      .find();
  }

  public async getPendingBookingsBetweenDates(queueId: string, dateFrom: Date, dateTo: Date): Promise<Booking[]> {
    const startDate = new Date(dateFrom).toISOString().slice(0,10);
    const endDate = new Date(dateTo).toISOString().slice(0,10);
    const dateFromValue = new Date(startDate);
    const dateToValue = new Date(endDate);
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('status', BookingStatus.PENDING)
      .whereGreaterOrEqualThan('dateFormatted', dateFromValue)
      .whereLessOrEqualThan('dateFormatted', dateToValue)
      .find();
  }

  featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  public async bookingEmail(booking: Booking): Promise<Booking[]> {
    const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(booking.commerceId, FeatureToggleName.EMAIL);
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'email-booking')){
      toNotify.push(booking);
    }
    const notified = [];
    const commerceLanguage = bookingCommerce.localeInfo.language;
    toNotify.forEach(async (booking) => {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        if (booking.user.email) {
          const template = `${NotificationTemplate.BOOKING}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          const logo = `${process.env.BACKEND_URL}/${bookingCommerce.logo}`;
          const bookingNumber = booking.number;
          const bookingDate = booking.date;
          const bookingblock = `${booking.block.hourFrom} - ${booking.block.hourTo}`;
          const commerce = bookingCommerce.name;
          await this.notificationService.createBookingEmailNotification(
            booking.user.email,
            NotificationType.BOOKING,
            booking.id,
            booking.commerceId,
            booking.queueId,
            template,
            bookingNumber,
            bookingDate,
            bookingblock,
            commerce,
            link,
            logo
          );
          notified.push(booking);
        }
      }
    });
    return notified;
  }

  public async bookingConfirmEmail(booking: Booking): Promise<Booking[]> {
    const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
    const featureToggle = bookingCommerce.features;
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'booking-email-confirm')){
      toNotify.push(booking);
    }
    const notified = [];
    const commerceLanguage = bookingCommerce.localeInfo.language;
    if (toNotify.length === 1) {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        if (booking.user && booking.user.email) {
          const template = `${NotificationTemplate.BOOKING_CONFIRM}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          const logo = `${process.env.BACKEND_URL}/${bookingCommerce.logo}`;
          const bookingNumber = booking.number;
          const bookingDate = booking.date;
          const bookingblock = `${booking.block.hourFrom} - ${booking.block.hourTo}`;
          const commerce = bookingCommerce.name;
          await this.notificationService.createBookingEmailNotification(
            booking.user.email,
            NotificationType.BOOKING_CONFIRM,
            booking.id,
            booking.commerceId,
            booking.queueId,
            template,
            bookingNumber,
            bookingDate,
            bookingblock,
            commerce,
            link,
            logo
          );
          notified.push(booking);
        }
      }
    };
    return notified;
  }

  public async bookingWhatsapp(booking: Booking): Promise<Booking[]> {
    const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(booking.commerceId, FeatureToggleName.WHATSAPP);
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'whatsapp-booking')){
      toNotify.push(booking);
    }
    const notified = [];
    let message = '';
    let type;
    if (toNotify.length === 1) {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        const user = booking.user;
        if(user && user.notificationOn) {
          type = NotificationType.BOOKING;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          message = bookingCommerce.localeInfo.language === 'pt'
          ?
`Olá, sua reserva em *${bookingCommerce.name}* foi feita com sucesso! Deve vir no dia *${booking.date}* ${booking.block && booking.block.hourFrom ? ` as ${booking.block.hourFrom}.` : `.`}

Lémbre-se, seu número de reserva é: *${booking.number}*. Mais detalhes neste link:

${link}

Obrigado!`
          :
`Hola, tu reserva en *${bookingCommerce.name}* fue generada con éxito. Debes venir el dia *${booking.date}* ${booking.block && booking.block.hourFrom ? ` a las ${booking.block.hourFrom}.` : `.`}

Recuerda, tu número de reserva es: *${booking.number}*. Más detalles en este link:

${link}

¡Muchas gracias!
`;
          await this.notificationService.createBookingWhatsappNotification(user.phone, booking.id, message, type, booking.id, booking.commerceId, booking.queueId);
          notified.push(booking);
        }
      }
    };
    return notified;
  }

  public async bookingConfirmWhatsapp(booking: Booking): Promise<Booking[]> {
    const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
    const featureToggle = bookingCommerce.features;
    let toNotify = [];
    if(this.featureToggleIsActive(featureToggle, 'booking-whatsapp-confirm')){
      toNotify.push(booking);
    }
    const notified = [];
    let message = '';
    let type;
    if (toNotify.length === 1) {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        const user = booking.user;
        if(user && user.notificationOn) {
          type = NotificationType.BOOKING_CONFIRM;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          message = bookingCommerce.localeInfo.language === 'pt'
          ?
`Olá, lembre-se da sua reserva em *${bookingCommerce.name}*! Deve vir no dia *${booking.date}* ${booking.block && booking.block.hourFrom ? `as ${booking.block.hourFrom}.` : `.`}

Poderá comparecer? Se sua resposta for *NÃO* por favor cancele sua reserva neste link:

${link}

Obrigado!`
          :
`Hola, recuerda tu reserva en *${bookingCommerce.name}*. Debes venir el dia *${booking.date}* ${booking.block && booking.block.hourFrom ? `a las ${booking.block.hourFrom}.` : `.`}

Podrás venir? Si tu respues es *NO* por favor cancela tu reserva en este link:

${link}

¡Muchas gracias!
`;
          await this.notificationService.createWhatsappNotification(user.phone, booking.id, message, type, booking.id, booking.commerceId, booking.queueId);
          notified.push(booking);
        }
      }
    };
    return notified;
  }

  public async getBookingDetails(id: string): Promise<BookingDetailsDto> {
    try {
      const booking = await this.getBookingById(id);
      let bookingDetailsDto: BookingDetailsDto = new BookingDetailsDto();

      bookingDetailsDto.id = booking.id;
      bookingDetailsDto.commerceId = booking.commerceId;
      bookingDetailsDto.createdAt = booking.createdAt;
      bookingDetailsDto.number = booking.number;
      bookingDetailsDto.date = booking.date;
      bookingDetailsDto.queueId = booking.queueId;
      bookingDetailsDto.status = booking.status;
      bookingDetailsDto.userId = booking.userId;
      bookingDetailsDto.comment = booking.comment;
      bookingDetailsDto.type = booking.type;
      bookingDetailsDto.channel = booking.channel;
      bookingDetailsDto.user = booking.user;
      bookingDetailsDto.processedAt = booking.processedAt;
      bookingDetailsDto.processed = booking.processed;
      bookingDetailsDto.cancelledAt= booking.cancelledAt;
      bookingDetailsDto.cancelled = booking.cancelled;
      bookingDetailsDto.attentionId = booking.attentionId;
      bookingDetailsDto.block = booking.block;
      if (booking.queueId) {
          bookingDetailsDto.queue = await this.queueService.getQueueById(booking.queueId);
          bookingDetailsDto.commerce = await this.commerceService.getCommerceById(bookingDetailsDto.queue.commerceId);
          delete bookingDetailsDto.commerce.queues;
      }
      const booked = await this.getBookingsBeforeYouByDate(booking.number, booking.queueId, booking.date);
      if (booked) {
        bookingDetailsDto.beforeYou = booked.length || 0;
      }
      return bookingDetailsDto;
    } catch(error) {
      throw `Hubo un problema al obtener detalles de la reserva: ${error.message}`;
    }
  }

  public async update(user: string, booking: Booking): Promise<Booking> {
    const bookingUpdated = await this.bookingRepository.update(booking);
    const bookingUpdatedEvent = new BookingUpdated(new Date(), bookingUpdated, { user });
    publish(bookingUpdatedEvent);
    return bookingUpdated;
  }

  public async cancelBooking(user: string, id: string): Promise<Booking> {
    let booking = undefined;
    try {
      booking = await this.getBookingById(id);
      booking.status = BookingStatus.RESERVE_CANCELLED;
      booking.cancelledAt = new Date();
      booking.cancelled = true;
      booking = await this.update(user, booking);
      await this.waitlistService.notifyWaitListFormCancelledBooking(booking);
    } catch (error) {
      throw new HttpException(`Hubo un problema al cancelar la reserva: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return booking;
  }

  private async processBooking(user: string, booking: Booking, attentionId: string): Promise<Booking> {
    let bookingToUpdate = booking;
    bookingToUpdate.processed = true;
    bookingToUpdate.processedAt = new Date();
    bookingToUpdate.status = BookingStatus.PROCESSED;
    bookingToUpdate.attentionId = attentionId;
    const bookingUpdated = await this.update(user, bookingToUpdate);
    return bookingUpdated;
  }

  private async createAttention(booking: Booking): Promise<Attention> {
    const { queueId, channel, user, block } = booking;
    const attention = await this.attentionService.createAttention(queueId, undefined, channel, user, undefined, block);
    await this.processBooking('ett', booking, attention.id);
    return attention;
  }

  public async processBookings(date: string): Promise<any> {
    if (!date) {
      throw new HttpException(`Error procesando Reservas: Fecha inválida`, HttpStatus.BAD_REQUEST);
    }
    const bookings = await this.getPendingBookingsByDate(date, 25);
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 10
    });
    const toProcess = bookings.length;
    const responses = [];
    const errors = [];
    if (bookings && bookings.length > 0) {
      for(let i = 0; i < bookings.length; i++) {
        const booking = bookings[i];
        limiter.schedule(async () => {
          try {
            const attention = await this.createAttention(booking)
            responses.push(attention);
          } catch (error) {
            errors.push(error);
          }
        });
      }
      await limiter.stop({ dropWaitingJobs: false });
    }
    const response = { toProcess, processed: responses.length, errors: errors.length };
    Logger.log(`processBooking response: ${response}`);
    return response;
  }

  public async createBookingFromWaitlist(waitlistId: string, blockNumber: number): Promise<Booking> {
    let booking: Booking = undefined;
    let waitlist: Waitlist = undefined;
    if (waitlistId) {
      waitlist = await this.waitlistService.getWaitlistById(waitlistId);
      if (waitlist) {
        if (waitlist.status !== WaitlistStatus.PENDING) {
          throw new HttpException(`Error procesando Waitlist: Ya fue procesada`, HttpStatus.BAD_REQUEST);
        }
        const queue = await this.queueService.getQueueById(waitlist.queueId);
        const blocks = queue.serviceInfo.blocks;
        let block = undefined;
        if (blocks && blocks.length > 0) {
          block = blocks.filter(block => {
            return block.number.toString() === blockNumber.toString();
          })[0];
        }
        booking = await this.createBooking(waitlist.queueId, waitlist.channel, waitlist.date, waitlist.user, block);
        if (booking && booking.id) {
          waitlist.bookingId = booking.id;
          waitlist.status = WaitlistStatus.PROCESSED;
          waitlist.processed = true;
          waitlist.processedAt = new Date();
          await this.waitlistService.update('', waitlist);
        }
      }
    }
    return booking;
  }

  public async confirmNotifyBookings(daysBefore: number = 1): Promise<any> {
    const date = new Date(new Date(new Date().setDate(new Date().getDate() + daysBefore))).toISOString().slice(0, 10);
    let bookings = [];
    const pendingBookings = await this.getPendingBookingsByDate(date, 25);
    if (!pendingBookings || pendingBookings.length === 0) {
      throw new HttpException(`Sin Reservas para confirmar`, HttpStatus.OK);
    }
    bookings = pendingBookings.filter(booking => {
      if (booking.confirmNotified === undefined || booking.confirmNotified === false) {
        return booking;
      }
    })
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 10
    });
    const toProcess = bookings.length;
    const responses = [];
    const errors = [];
    let emails = [];
    let messages = [];
    if (bookings && bookings.length > 0) {
      for(let i = 0; i < bookings.length; i++) {
        let booking = bookings[i];
        limiter.schedule(async () => {
          try {
            const email = await this.bookingConfirmEmail(booking);
            const message = await this.bookingConfirmWhatsapp(booking);
            if (email && email[0] && email[0].id) {
              booking.confirmNotifiedEmail = true;
              emails.push(email[0]);
            }
            if (message && message[0] && message[0].id) {
              booking.confirmNotifiedWhatsapp = true;
              messages.push(message[0]);
            }
            booking.confirmNotified = true;
            await this.update('ett', booking);
          } catch (error) {
            errors.push(error.message);
          }
          responses.push(booking);
        });
      }
      await limiter.stop({ dropWaitingJobs: false });
    }
    const response = { toProcess, processed: responses.length, emails: emails.length, messages: messages.length, errors: errors.length };
    Logger.log(`confirmNotifyBookings response: ${response}`);
    return response;
  }
}