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
import { AttentionService } from 'src/attention/attention.service';
import { Attention } from 'src/attention/model/attention.entity';
import { WaitlistService } from '../waitlist/waitlist.service';
import { Waitlist } from 'src/waitlist/model/waitlist.entity';
import { WaitlistStatus } from '../waitlist/model/waitlist-status.enum';
import { Block } from '../waitlist/model/waitlist.entity';
import { AttentionType } from 'src/attention/model/attention-type.enum';
import Bottleneck from "bottleneck";
import BookingUpdated from './events/BookingUpdated';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { QueueType } from 'src/queue/model/queue-type.enum';
import { BookingAvailabilityDto } from './dto/booking-availability.dto';
import { ClientService } from '../client/client.service';
import { getDateDDMMYYYY } from 'src/shared/utils/date';

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
    private waitlistService: WaitlistService,
    private clientService: ClientService
  ) { }

  public async getBookingById(id: string): Promise<Booking> {
    return await this.bookingRepository.findById(id);
  }

  public async createBooking(
      queueId: string,
      channel: string = BookingChannel.QR,
      date: string,
      user?: User,
      block?: Block,
      status?: BookingStatus,
      servicesId?: string[],
      servicesDetails?: object[],
      clientId?: string
    ): Promise<Booking> {
    let bookingCreated;
    let queue = await this.queueService.getQueueById(queueId);
    const commerce = await this.commerceService.getCommerceById(queue.commerceId);
    const [year, month, day] = date.split('-');
    const dateFormatted = new Date(+year, +month-1, +day);
    const newDateFormatted = dateFormatted.toISOString().slice(0,10);
    const booked = await this.getPendingBookingsByQueueAndDate(queueId, newDateFormatted);
    if (booked.length >= queue.limit) {
      throw new HttpException(`Limite de la fila ${queue.id} - ${queue.name} (${queue.limit}) alcanzado para la fecha ${newDateFormatted}`, HttpStatus.INTERNAL_SERVER_ERROR);
    } else {
      let bookingNumber;
      if (block && Object.keys(block).length > 0 && queue.type !== QueueType.SELECT_SERVICE) {
        bookingNumber = block.number;
        const alreadyBooked = await this.getPendingBookingsByNumberAndQueueAndDate(queueId, date, bookingNumber);
        if (alreadyBooked.length > 0) {
          throw new HttpException(`Ya fue realizada una reserva en este bloque: ${bookingNumber}, booking: ${JSON.stringify(alreadyBooked)}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        const dateBookings = await this.getBookingsByQueueAndDate(queueId, date);
        const amountOfBookings = dateBookings.length || 0;
        bookingNumber = amountOfBookings + 1;
      }
      let email = undefined;
      let phone = undefined;
      if (clientId !== undefined) {
        const client = await this.clientService.getClientById(clientId);
        if (client && client.id) {
          user = { ...user,
            email: client.email || user.email,
            phone: client.phone || user.phone,
            name: client.name || user.name,
            lastName: client.lastName || user.lastName,
            personalInfo: client.personalInfo || user.personalInfo,
            idNumber: client.idNumber || user.idNumber
          };
          if (client.email) {
            email = client.email;
          }
          if (client.phone) {
            phone = client.phone;
          }
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
          throw new HttpException(`Error creando reserva: Cliente no existe ${clientId}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }
      bookingCreated = await this.bookingDefaultBuilder.create(bookingNumber, date, commerce, queue, channel, user, block, status, servicesId, servicesDetails, clientId);
      if (user.email !== undefined) {
        email = user.email;
      }
      if (user.phone !== undefined) {
        phone = user.phone;
      }
      if (email !== undefined) {
        await this.bookingEmail(bookingCreated);
      }
      if (phone !== undefined) {
        await this.bookingWhatsapp(bookingCreated);
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
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .find();
  }

  public async getPendingBookingsByNumberAndQueueAndDate(queueId: string, date: string, number: number): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereEqualTo('number', number)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
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

  public async getConfirmedBookingsByDate(date: string, limit: number = 100): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('date', date)
      .whereIn('status', [BookingStatus.CONFIRMED])
      .orderByAscending('number')
      .limit(limit)
      .find();
  }

  public async getBookingsBeforeYouByDate(number: number, queueId: string, date: string): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereLessThan('number', number)
      .find();
  }

  public async getPendingBookingsByClient(commerceId: string, idNumber: string, clientId: string): Promise<Booking[]> {
    let results: Booking[] = [];
    if (clientId) {
      results = await this.bookingRepository
        .whereEqualTo('commerceId', commerceId)
        .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
        .whereEqualTo('clientId', clientId)
        .find();
      if (results.length === 0 && idNumber) {
        const bookings = await this.bookingRepository
          .whereEqualTo('commerceId', commerceId)
          .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
          .find();
        if (bookings && bookings.length > 0) {
          bookings.forEach(booking => {
            if (booking.user) {
              if (booking.user.idNumber === idNumber) {
                results.push(booking);
              }
            }
          })
        }
      }
      return results;
    }
  }

  public async getPendingBookingsBetweenDates(queueId: string, dateFrom: Date, dateTo: Date): Promise<BookingAvailabilityDto[]> {
    const startDate = new Date(dateFrom).toISOString().slice(0,10);
    const endDate = new Date(dateTo).toISOString().slice(0,10);
    const dateFromValue = new Date(startDate);
    const dateToValue = new Date(endDate);
    let bookings: BookingAvailabilityDto[] = [];
    const results = await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereGreaterOrEqualThan('dateFormatted', dateFromValue)
      .whereLessOrEqualThan('dateFormatted', dateToValue)
      .find();
    if (results && results.length > 0) {
      results.forEach(result => {
        const booking = new BookingAvailabilityDto();
        booking.id = result.id;
        booking.commerceId = result.commerceId;
        booking.queueId = result.queueId;
        booking.number = result.number;
        booking.date = result.date;
        booking.status = result.status;
        booking.user = result.user;
        bookings.push(booking);
      })
    }
    return bookings;
  }

  public async getPendingCommerceBookingsByDate(commerceId: string, date: string): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('commerceId', commerceId)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereEqualTo('date', date)
      .find();
  }

  public async getPendingCommerceBookingsBetweenDates(commerceId: string, dateFrom: Date, dateTo: Date): Promise<BookingAvailabilityDto[]> {
    const startDate = new Date(dateFrom).toISOString().slice(0,10);
    const endDate = new Date(dateTo).toISOString().slice(0,10);
    const dateFromValue = new Date(startDate);
    const dateToValue = new Date(endDate);
    let bookings: BookingAvailabilityDto[] = [];
    const results = await this.bookingRepository
      .whereEqualTo('commerceId', commerceId)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereGreaterOrEqualThan('dateFormatted', dateFromValue)
      .whereLessOrEqualThan('dateFormatted', dateToValue)
      .find();
    if (results && results.length > 0) {
      results.forEach(result => {
        const booking = new BookingAvailabilityDto();
        booking.id = result.id;
        booking.commerceId = result.commerceId;
        booking.queueId = result.queueId;
        booking.number = result.number;
        booking.date = result.date;
        booking.status = result.status;
        booking.user = result.user;
        bookings.push(booking);
      })
    }
    return bookings;
  }

  public async getPendingBookingsBeforeDate(dateTo: Date): Promise<Booking[]> {
    const endDate = new Date(dateTo).toISOString().slice(0,10);
    const dateToValue = new Date(endDate);
    return await this.bookingRepository
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereLessThan('dateFormatted', dateToValue)
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
          const bookingDate = getDateDDMMYYYY(booking.date);
          type = NotificationType.BOOKING;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          message = bookingCommerce.localeInfo.language === 'pt'
          ?
`Olá, sua reserva em *${bookingCommerce.name}* foi feita com sucesso! Deve vir no dia *${bookingDate}* ${booking.block && booking.block.hourFrom ? ` as ${booking.block.hourFrom}.` : `.`}

Lémbre-se, seu número de reserva é: *${booking.number}*. Mais detalhes neste link:

${link}

Obrigado!`
          :
`Hola, tu reserva en *${bookingCommerce.name}* fue generada con éxito. Debes venir el dia *${bookingDate}* ${booking.block && booking.block.hourFrom ? ` a las ${booking.block.hourFrom}.` : `.`}

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
          const bookingDate = getDateDDMMYYYY(booking.date);
          type = NotificationType.BOOKING_CONFIRM;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          message = bookingCommerce.localeInfo.language === 'pt'
          ?
`Olá, lembre-se da sua reserva em *${bookingCommerce.name}*! Deve vir no dia *${bookingDate}* ${booking.block && booking.block.hourFrom ? `as ${booking.block.hourFrom}.` : `.`}

Poderá comparecer? Se sua resposta for *NÃO* por favor cancele sua reserva neste link:

${link}

Obrigado!`
          :
`Hola, recuerda tu reserva en *${bookingCommerce.name}*. Debes venir el dia *${bookingDate}* ${booking.block && booking.block.hourFrom ? `a las ${booking.block.hourFrom}.` : `.`}

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
    } catch (error) {
      throw new HttpException(`Hubo un problema al obtener detalles de la reserva: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
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

  public async confirmBooking(user: string, id: string, confirmationData: PaymentConfirmation): Promise<Booking> {
    try {
      let booking = await this.getBookingById(id);
      if (booking && booking.id) {
        const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
        const featureToggle = bookingCommerce.features;
        if (this.featureToggleIsActive(featureToggle, 'booking-confirm')){
          booking.status = BookingStatus.CONFIRMED;
          booking.confirmedAt = new Date();
          booking.confirmed = true;
          if (this.featureToggleIsActive(featureToggle, 'booking-confirm-payment')){
            if (confirmationData === undefined || confirmationData.paid === false || !confirmationData.paymentDate || !confirmationData.paymentAmount) {
              throw new HttpException(`Datos insuficientes para confirmar el pago de la reserva`, HttpStatus.INTERNAL_SERVER_ERROR);
            }
            confirmationData.user = user ? user : 'ett';
            booking.confirmationData = confirmationData;
          }
          booking = await this.update(user, booking);
          const today = new Date().toISOString().slice(0,10);
          if (booking.date === today) {
            await this.createAttention(user, booking);
          }
        }
        return booking;
      }
    } catch (error) {
      throw new HttpException(`Hubo un problema al confirmar la reserva: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
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

  private async createAttention(userIn: string, booking: Booking): Promise<Attention> {
    const { id, queueId, channel, user, block, confirmationData, servicesId, servicesDetails, clientId } = booking;
    const attention = await this.attentionService.createAttention(queueId, undefined, channel, user, undefined, block, undefined, confirmationData, id, servicesId, servicesDetails, clientId);
    await this.processBooking(userIn, booking, attention.id);
    return attention;
  }

  public async processBookings(date: string): Promise<any> {
    if (!date) {
      throw new HttpException(`Error procesando Reservas: Fecha inválida`, HttpStatus.BAD_REQUEST);
    }
    let bookings = await this.getConfirmedBookingsByDate(date, 25);
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
            const attention = await this.createAttention('ett', booking)
            responses.push(attention);
          } catch (error) {
            errors.push(error);
          }
        });
      }
      await limiter.stop({ dropWaitingJobs: false });
    }
    const response = { toProcess, processed: responses.length, errors: errors.length };
    Logger.log(`processBooking response: ${JSON.stringify(response)}`);
    return response;
  }

  public async processBookingById(user: string, id: string): Promise<any> {
    if (!id) {
      throw new HttpException(`Error procesando Reserva: Id inválido`, HttpStatus.BAD_REQUEST);
    }
    let booking = await this.getBookingById(id);
    const toProcess = 1;
    const responses = [];
    const errors = [];
    if (booking && booking.id) {
      try {
        const attention = await this.createAttention(user, booking)
        responses.push(attention);
      } catch (error) {
        errors.push(error);
      }
    }
    const response = { toProcess, processed: responses.length, errors: errors.length };
    Logger.log(`processBooking response: ${JSON.stringify(response)}`);
    return response;
  }

  public async processPastBooking(bookingId: string, collaboratorId: string, commerceLanguage: string): Promise<any> {
    const response = { booking: {}, attention: {}, processBooking: {}, attend: {}, finish: {} };
    try {
      const booking = await this.getBookingById(bookingId);
      response.booking = booking;
      if (booking && booking.id) {
        const { queueId, channel, user, block, date } = booking;
        const dateOfAttention = new Date(date);
        const attention = await this.attentionService.createAttention(queueId, collaboratorId, channel, user, AttentionType.STANDARD, block, dateOfAttention);
        response.attention = attention;
        if (attention && attention.id) {
          const { number } = attention;
          const processBooking = await this.processBooking('ett', booking, attention.id);
          response.processBooking = processBooking;
          const attend = await this.attentionService.attend('ETT-MIGRATION', number, queueId, collaboratorId, commerceLanguage);
          const finish = await this.attentionService.finishAttention('ett', attention.id, 'MIGRATION', dateOfAttention);
          response.finish = finish;
          response.attend = attend;
        }
      }
    } catch (error) {
      Logger.error(`processBooking error: ${error.message}`);
    }
    Logger.log(`processPastBooking response: ${JSON.stringify(response)}`);
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
    const pendingBookings = await this.getConfirmedBookingsByDate(date, 25);
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
    Logger.log(`confirmNotifyBookings response: ${JSON.stringify(response)}`);
    return response;
  }

  public async cancelBookings(): Promise<any> {
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 10
    });
    const responses = [];
    const errors = [];
    let toProcess = 0;
    try {
      const bookings = await this.getPendingBookingsBeforeDate(new Date());
      toProcess = bookings.length;
      if (bookings && bookings.length > 0) {
        for(let i = 0; i < bookings.length; i++) {
          let booking = bookings[i];
          limiter.schedule(async () => {
            try {
              booking.status = BookingStatus.RESERVE_CANCELLED;
              booking.cancelledAt = new Date();
              booking.cancelled = true;
              await this.update('ett', booking);
            } catch (error) {
              errors.push(error);
            }
            responses.push(booking);
          });
        }
        await limiter.stop({ dropWaitingJobs: false });
      }
      const response = { toProcess, processed: responses.length, errors: errors.length };
      Logger.log(`cancelBookings response: ${JSON.stringify(response)}`);
      return response;
    } catch (error) {
      throw new HttpException(`Hubo un poblema al cancelar las reservas: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async transferBookingToQueue(user: string, id: string, queueId: string): Promise<Booking> {
    let booking = undefined;
    try {
      booking = await this.getBookingById(id);
      const queueToTransfer = await this.queueService.getQueueById(queueId);
      if (booking && booking.id) {
        if (queueToTransfer && queueToTransfer.id) {
          if (queueToTransfer.type === QueueType.COLLABORATOR) {
            booking.transfered = true;
            booking.transferedAt = new Date();
            booking.transferedOrigin = booking.queueId;
            booking.queueId = queueId;
            booking.transferedCount = booking.transferedCount ? booking.transferedCount + 1 : 1;
            booking.transferedBy = user;
            booking = await this.update(user, booking);
          } else {
            throw new HttpException(`Reserva ${id} no puede ser transferida pues la cola de destino no es de tipo Colaborador: ${queueId}, ${queueToTransfer.type}`, HttpStatus.NOT_FOUND);
          }
        } else {
          throw new HttpException(`Cola no existe: ${queueId}`, HttpStatus.NOT_FOUND);
        }
      } else {
        throw new HttpException(`Reserva no existe: ${id}`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(`Hubo un problema al transferir la reserva: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return booking;
  }

  public async editBookingDateAndBlock(user: string, id: string, date: string, block: Block): Promise<Booking> {
    let booking = undefined;
    try {
      booking = await this.getBookingById(id);
      if (booking && booking.id) {
        if (date && block) {
          booking.edited = true;
          booking.editedAt = new Date();
          booking.editedDateOrigin = booking.date;
          booking.editedBlockOrigin = booking.block;
          booking.date = date;
          const [year, month, day] = date.split('-');
          booking.dateFormatted = new Date(+year, +month-1, +day);
          booking.block = block;
          booking.editedCount = booking.editedCount ? booking.editedCount + 1 : 1;
          booking.editedBy = user;
          booking = await this.update(user, booking);
        } else {
          throw new HttpException(`Datos para editar no son correctos: Date: ${date}, Block: ${JSON.stringify(block)}`, HttpStatus.BAD_REQUEST);
        }
      } else {
        throw new HttpException(`Reserva no existe: ${id}`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(`Hubo un problema al editar la reserva: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return booking;
  }
}