import { HttpException, HttpStatus, Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { AttentionService } from 'src/attention/attention.service';
import { AttentionType } from 'src/attention/model/attention-type.enum';
import { Attention } from 'src/attention/model/attention.entity';
import { BookingBlockNumberUsedService } from 'src/booking-block-number-used/booking-block-number-used.service';
import { Commerce } from 'src/commerce/model/commerce.entity';
import { IncomeStatus } from 'src/income/model/income-status.enum';
import { IncomeType } from 'src/income/model/income-type.enum';
import { Attachment } from 'src/notification/model/email-input.dto';
import { NotificationTemplate } from 'src/notification/model/notification-template.enum';
import { PackageStatus } from 'src/package/model/package-status.enum';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { QueueType } from 'src/queue/model/queue-type.enum';
import { Queue } from 'src/queue/model/queue.entity';
import { getDateDDMMYYYY } from 'src/shared/utils/date';
import { DateModel } from 'src/shared/utils/date.model';
import { Waitlist } from 'src/waitlist/model/waitlist.entity';

import { Block } from '../booking/model/booking.entity';
import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { CommerceLogoService } from '../commerce-logo/commerce-logo.service';
import { DocumentsService } from '../documents/documents.service';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { FeatureToggle } from '../feature-toggle/model/feature-toggle.entity';
import { FeatureToggleName } from '../feature-toggle/model/feature-toggle.enum';
import { IncomeService } from '../income/income.service';
import { ProfessionalService } from '../professional/professional.service';
import { NotificationType } from '../notification/model/notification-type.enum';
import { NotificationService } from '../notification/notification.service';
import { PackageType } from '../package/model/package-type.enum';
import { PackageService } from '../package/package.service';
import { QueueService } from '../queue/queue.service';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';
import { AuditLogService } from '../shared/services/audit-log.service';
import { TelemedicineService } from '../telemedicine/telemedicine.service';
import { User } from '../user/model/user.entity';
import { UserService } from '../user/user.service';
import { WaitlistStatus } from '../waitlist/model/waitlist-status.enum';
import { WaitlistService } from '../waitlist/waitlist.service';

import { BookingDefaultBuilder } from './builders/booking-default';
import { BookingAvailabilityDto } from './dto/booking-availability.dto';
import { BookingDetailsDto } from './dto/booking-details.dto';
import BookingCreated from './events/BookingCreated';
import BookingUpdated from './events/BookingUpdated';
import ProfessionalAssignedToBooking from './events/ProfessionalAssignedToBooking';
import TermsAccepted from '../shared/events/TermsAccepted';
import { LgpdConsentService } from '../shared/services/lgpd-consent.service';
import { ConsentType } from '../shared/model/lgpd-consent.entity';
import { ConsentStatus } from '../shared/model/lgpd-consent.entity';
import { ConsentOrchestrationService } from '../shared/services/consent-orchestration.service';
import { ConsentRequestTiming } from '../shared/model/consent-requirement.entity';
import { BookingChannel } from './model/booking-channel.enum';
import { BookingStatus } from './model/booking-status.enum';
import { BookingType } from './model/booking-type.enum';
import { Booking } from './model/booking.entity';
import * as NOTIFICATIONS from './notifications/notifications.js';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking),
    private queueService: QueueService,
    private notificationService: NotificationService,
    private featureToggleService: FeatureToggleService,
    private commerceService: CommerceService,
    private commerceLogoService: CommerceLogoService,
    private bookingDefaultBuilder: BookingDefaultBuilder,
    @Inject(forwardRef(() => AttentionService))
    private attentionService: AttentionService,
    private waitlistService: WaitlistService,
    private clientService: ClientService,
    private incomeService: IncomeService,
    @Inject(forwardRef(() => PackageService))
    private packageService: PackageService,
    private userService: UserService,
    private documentsService: DocumentsService,
    private bookingBlockNumbersUsedService: BookingBlockNumberUsedService,
    @Inject(forwardRef(() => TelemedicineService))
    private telemedicineService: TelemedicineService,
    @Inject(GcpLoggerService)
    private readonly logger: GcpLoggerService,
    private professionalService: ProfessionalService,
    @Optional() @Inject(AuditLogService) private auditLogService?: AuditLogService,
    @Optional() @Inject(LgpdConsentService) private lgpdConsentService?: LgpdConsentService,
    @Optional() @Inject(forwardRef(() => ConsentOrchestrationService))
    private consentOrchestrationService?: ConsentOrchestrationService
  ) {
    this.logger.setContext('BookingService');
  }

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
      this.logger.error(`Error getting commerce logo for email: commerceId=${commerceId}, error=${error}`);
      return defaultLogoUrl;
    }
  }

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
    clientId?: string,
    sessionId?: string,
    type?: string,
    telemedicineConfig?: {
      type: 'VIDEO' | 'CHAT' | 'BOTH';
      scheduledAt: string;
      recordingEnabled?: boolean;
      notes?: string;
    }
  ): Promise<Booking> {
    let bookingCreated;
    const queue = await this.queueService.getQueueById(queueId);
    const commerce = await this.commerceService.getCommerceById(queue.commerceId);
    if (user && (user.acceptTermsAndConditions === false || !user.acceptTermsAndConditions)) {
      throw new HttpException(
        `No ha aceptado los terminos y condiciones`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    const validateBookingBlocks = await this.validateBookingBlocksToCreate(
      sessionId,
      queue,
      date,
      block
    );
    if (validateBookingBlocks === false) {
      await this.bookingBlockNumbersUsedService.deleteTakenBookingsBlocksByDate(
        sessionId,
        queueId,
        date,
        block
      );
      throw new HttpException(`Al menos un bloque horario ya fue reservado`, HttpStatus.CONFLICT);
    }
    // Validate date format before processing
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new HttpException(
        `Formato de fecha inválido: ${date}. Debe ser YYYY-MM-DD`,
        HttpStatus.BAD_REQUEST
      );
    }
    const [year, month, day] = date.split('-');
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    // Validate date values
    if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum) ||
        monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      throw new HttpException(
        `Fecha inválida: ${date}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const dateFormatted = new Date(yearNum, monthNum - 1, dayNum);
    // Verify date is valid (not adjusted by Date constructor)
    if (dateFormatted.getFullYear() !== yearNum ||
        dateFormatted.getMonth() !== monthNum - 1 ||
        dateFormatted.getDate() !== dayNum) {
      throw new HttpException(
        `Fecha inválida: ${date}`,
        HttpStatus.BAD_REQUEST
      );
    }
    const newDateFormatted = dateFormatted.toISOString().slice(0, 10);

    // Validate queue is active and available
    if (!queue.active) {
      throw new HttpException(
        `La fila ${queue.id} - ${queue.name} no está activa`,
        HttpStatus.BAD_REQUEST
      );
    }
    if (!queue.available) {
      throw new HttpException(
        `La fila ${queue.id} - ${queue.name} no está disponible`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate queue limit is valid
    if (!queue.limit || queue.limit <= 0) {
      throw new HttpException(
        `Límite de la fila ${queue.id} - ${queue.name} no es válido`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }


    // Validate services duration if servicesDetails provided
    if (servicesDetails && Array.isArray(servicesDetails)) {
      for (const serviceDetail of servicesDetails) {
        if (serviceDetail && typeof serviceDetail === 'object') {
          const serviceDetailAny = serviceDetail as any;
          const duration = serviceDetailAny.duration || serviceDetailAny.durationMinutes;
          if (duration !== undefined) {
            const durationNum = typeof duration === 'number' ? duration : parseInt(String(duration), 10);
            if (isNaN(durationNum) || durationNum <= 0 || durationNum > 1440) { // Max 24 hours
              throw new HttpException(
                `Duración de servicio inválida: ${duration}. Debe ser un número positivo menor a 1440 minutos`,
                HttpStatus.BAD_REQUEST
              );
            }
          }
        }
      }
    }

    // Re-check queue limit after validation (atomic check before creation)
    const booked = await this.getPendingBookingsByQueueAndDate(queueId, newDateFormatted);
    if (booked.length >= queue.limit) {
      throw new HttpException(
        `Limite de la fila ${queue.id} - ${queue.name} (${queue.limit}) alcanzado para la fecha ${newDateFormatted}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    } else {
      let bookingNumber;
      if (block && Object.keys(block).length > 0 && queue.type !== QueueType.SELECT_SERVICE) {
        // Extract block number - handle both direct number and blocks array
        if (block.number !== undefined) {
          bookingNumber = block.number;
        } else if (
          block &&
          block.blocks &&
          block.blocks.length > 0 &&
          block.blocks[0].number !== undefined
        ) {
          bookingNumber = block.blocks[0].number;
        } else if (block && block.blockNumbers && block.blockNumbers.length > 0) {
          bookingNumber = block.blockNumbers[0];
        }

        // Only query if bookingNumber is defined
        if (bookingNumber !== undefined) {
          // Validate blockLimit is valid
          let blockLimit = 0;
          if (queue.serviceInfo && queue.serviceInfo.blockLimit) {
            if (queue.serviceInfo.blockLimit <= 0) {
              throw new HttpException(
                `Límite de bloque no es válido para la fila ${queue.id}`,
                HttpStatus.INTERNAL_SERVER_ERROR
              );
            }
            blockLimit = queue.serviceInfo.blockLimit;
          }

          // For super blocks, validate ALL block numbers, not just the first one
          let blockNumbersToCheck = [bookingNumber];
          if (block && block.blockNumbers && block.blockNumbers.length > 0) {
            blockNumbersToCheck = block.blockNumbers;
          } else if (block && block.blocks && block.blocks.length > 0) {
            blockNumbersToCheck = block.blocks
              .map(b => b.number)
              .filter(num => num !== undefined);
          }

          // Check each block number
          for (const blockNum of blockNumbersToCheck) {
            const alreadyBooked = await this.getPendingBookingsByNumberAndQueueAndDate(
              queueId,
              date,
              blockNum
            );
            if (blockLimit > 0 && alreadyBooked.length >= blockLimit) {
              throw new HttpException(
                `Ya se alcanzó el límite de reservas en el bloque: ${blockNum}, bookings: ${alreadyBooked.length}, limite: ${blockLimit}`,
                HttpStatus.INTERNAL_SERVER_ERROR
              );
            }
          }
        }
      } else {
        // For SELECT_SERVICE queues, get bookings and assign number atomically
        // Re-check to minimize race condition window
        const dateBookings = await this.getBookingsByQueueAndDate(queueId, date);
        const amountOfBookings = dateBookings.length || 0;
        bookingNumber = amountOfBookings + 1;

        // Double-check queue limit hasn't been exceeded (race condition mitigation)
        if (amountOfBookings >= queue.limit) {
          throw new HttpException(
            `Limite de la fila ${queue.id} - ${queue.name} (${queue.limit}) alcanzado para la fecha ${newDateFormatted}`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      }
      let email = undefined;
      let phone = undefined;
      let client;
      if (clientId !== undefined) {
        client = await this.clientService.getClientById(clientId);
        if (client && client.id) {
          // Merge client data with user data, preferring more recent data
          // Compare timestamps if available, otherwise prefer user data (more recent by default)
          const clientUpdatedAt = client.updatedAt ? new Date(client.updatedAt).getTime() : 0;
          const userUpdatedAt = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();

          user = {
            ...user,
            // Only overwrite if client data is more recent, otherwise keep user data
            email: (clientUpdatedAt > userUpdatedAt && client.email) ? client.email : (user.email || client.email),
            phone: (clientUpdatedAt > userUpdatedAt && client.phone) ? client.phone : (user.phone || client.phone),
            name: (clientUpdatedAt > userUpdatedAt && client.name) ? client.name : (user.name || client.name),
            lastName: (clientUpdatedAt > userUpdatedAt && client.lastName) ? client.lastName : (user.lastName || client.lastName),
            personalInfo: (clientUpdatedAt > userUpdatedAt && client.personalInfo) ? client.personalInfo : (user.personalInfo || client.personalInfo),
            idNumber: (clientUpdatedAt > userUpdatedAt && client.idNumber) ? client.idNumber : (user.idNumber || client.idNumber),
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
          throw new HttpException(
            `Error creando reserva: Cliente no existe ${clientId}`,
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      } else {
        const clientForUserId = client ? client.id : undefined;
        const userCreated = await this.userService.createUser(
          user.name,
          user.phone,
          user.email,
          queue.commerceId,
          queue.id,
          user.lastName,
          user.idNumber,
          user.notificationOn,
          user.notificationEmailOn,
          user.personalInfo,
          clientForUserId,
          user.acceptTermsAndConditions
        );
        if (userCreated && userCreated.id) {
          user = { ...user, ...userCreated };
          clientId = userCreated.clientId;
        }
      }
      bookingCreated = await this.bookingDefaultBuilder.create(
        bookingNumber,
        date,
        commerce,
        queue,
        channel,
        user,
        block,
        status,
        servicesId,
        servicesDetails,
        clientId,
        type,
        telemedicineConfig
      );
      if (user.email !== undefined) {
        email = user.email;
      }
      if (user.phone !== undefined) {
        phone = user.phone;
      }
      // Send notifications, but don't fail booking creation if notifications fail
      if (email !== undefined) {
        try {
          this.bookingEmail(bookingCreated);
          this.bookingCommerceConditionsEmail(bookingCreated);
        } catch (error) {
          this.logger.error(
            `Failed to send booking email for booking ${bookingCreated.id}: ${error.message}`,
            undefined,
            `bookingId: ${bookingCreated.id}, email: ${email}`
          );
          // Don't throw - booking is already created
        }
      }
      if (phone !== undefined) {
        try {
          this.bookingWhatsapp(bookingCreated);
        } catch (error) {
          this.logger.error(
            `Failed to send booking WhatsApp for booking ${bookingCreated.id}: ${error.message}`,
            undefined,
            `bookingId: ${bookingCreated.id}, phone: ${phone}`
          );
          // Don't throw - booking is already created
        }
      }
      this.logger.info('Booking created successfully', {
        bookingId: bookingCreated.id,
        queueId,
        commerceId: queue.commerceId,
        bookingNumber,
        date,
        channel,
        status: bookingCreated.status,
        clientId,
        hasBlock: !!block,
      });

      // Publish BookingCreated event
      try {
        const bookingCreatedEvent = new BookingCreated(new Date(), bookingCreated, { user });
        this.logger.info(`[BookingService] Publishing BookingCreated event for booking ${bookingCreated.id} with status ${bookingCreated.status}`, {
          bookingId: bookingCreated.id,
          eventType: 'ett.booking.1.event.booking.created',
          status: bookingCreated.status,
          queueId: bookingCreated.queueId,
          commerceId: bookingCreated.commerceId,
        });
        publish(bookingCreatedEvent);
        this.logger.info(`[BookingService] ✅ BookingCreated event published successfully for booking ${bookingCreated.id}`);
      } catch (error) {
        this.logger.error(
          `[BookingService] ❌ Failed to publish BookingCreated event for booking ${bookingCreated.id}: ${error.message}`,
          error.stack,
          `bookingId: ${bookingCreated.id}, error: ${error.message}`
        );
        // Don't throw - booking is already created, event publishing failure shouldn't break the flow
      }

      // Hook: Solicitar consentimientos pendientes automáticamente
      if (
        this.consentOrchestrationService &&
        bookingCreated.clientId &&
        bookingCreated.commerceId
      ) {
        try {
          const userId: string = typeof user === 'string' ? user : (user?.id || 'system');
          await this.consentOrchestrationService.requestAllPendingConsents(
            bookingCreated.commerceId,
            bookingCreated.clientId,
            ConsentRequestTiming.BOOKING,
            userId
          );
          this.logger.log(
            `[BookingService] Consent request sent for booking ${bookingCreated.id}`
          );
        } catch (error) {
          this.logger.error(
            `[BookingService] Failed to request consents for booking ${bookingCreated.id}: ${error.message}`,
            error.stack
          );
          // Don't throw - consent request failure shouldn't break booking creation
        }
      }
    }
    return bookingCreated;
  }

  public async validateBookingBlocksToCreate(
    sessionId: string,
    queue: Queue,
    date: string,
    block: Block
  ) {
    let blocks: Block[] = [];
    let queueLimit = 1;
    if (queue && queue.id && queue.serviceInfo && queue.serviceInfo.blockLimit) {
      queueLimit = queue.serviceInfo.blockLimit || 1;
    }
    if (block && block.blocks && block.blocks.length > 0) {
      blocks = block.blocks;
    } else if (block) {
      blocks.push(block);
    }
    const takenBlocks = await this.bookingBlockNumbersUsedService.getTakenBookingsBlocksByDate(
      undefined,
      queue.id,
      date
    );
    if (takenBlocks && takenBlocks.length > 0) {
      const takenHoursFrom = takenBlocks
        .filter(block => block.sessionId !== sessionId)
        .map(block => block.hourFrom);
      const requestedHoursFrom = blocks.map(block => block.hourFrom);
      if (queueLimit === 1) {
      if (takenBlocks.length === 1) {
        // Check if the single taken block is from the same session
        const isSameSession = takenBlocks[0].sessionId === sessionId;
        // If same session, allow; if different session, block is taken
        return isSameSession;
      } else {
        const includesAll = requestedHoursFrom.every(hour => {
          const count = takenHoursFrom.filter(hr => hr === hour).length;
          if (count < queueLimit) {
            return true;
          }
          // Explicitly return false if limit reached
          return false;
        });
        if (includesAll === false) {
          if (requestedHoursFrom.length > 1) {
            const pos = takenBlocks.findIndex(block => block.sessionId === sessionId);
            if (pos <= requestedHoursFrom.length - 1) {
              return true;
            }
          }
        }
        return includesAll;
      }
      } else {
        const checkedHours = requestedHoursFrom.every(hour => {
          const count = takenHoursFrom.filter(hr => hr === hour).length;
          if (count < queueLimit) {
            return true;
          }
        });
        return checkedHours;
      }
    } else {
      return true;
    }
  }

  public async validateBookingBlocks(queue: Queue, date: string, block: Block) {
    let blocks: Block[] = [];
    let queueLimit = 1;
    if (queue && queue.id && queue.serviceInfo && queue.serviceInfo.blockLimit) {
      queueLimit = queue.serviceInfo.blockLimit || 1;
    }
    if (block && block.blocks && block.blocks.length > 0) {
      blocks = block.blocks;
    } else if (block) {
      blocks.push(block);
    }
    const takenBlocks = await this.bookingBlockNumbersUsedService.getTakenBookingsBlocksByDate(
      undefined,
      queue.id,
      date
    );
    if (takenBlocks && takenBlocks.length > 0) {
      const takenHoursFrom = takenBlocks.map(block => block.hourFrom);
      const requestedHoursFrom = blocks.map(block => block.hourFrom);
      if (queueLimit === 1) {
        const includesAll = requestedHoursFrom.every(hour => takenHoursFrom.includes(hour));
        if (includesAll) {
          return false;
        }
        return true;
      } else {
        const checkedHours = requestedHoursFrom.every(hour => {
          const count = takenHoursFrom.filter(hr => hr === hour).length;
          if (count < queueLimit) {
            return true;
          }
          // Explicitly return false if limit reached
          return false;
        });
        return checkedHours;
      }
    } else {
      return true;
    }
  }

  public async getBookingsByDate(date: string): Promise<Booking[]> {
    if (date === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('date', date)
      .orderByDescending('number')
      .find();
  }

  public async getBookingsByQueueAndDate(queueId: string, date: string): Promise<Booking[]> {
    if (queueId === undefined || date === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .find();
  }

  public async getPendingBookingsByQueueAndDate(queueId: string, date: string): Promise<Booking[]> {
    if (queueId === undefined || date === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .find();
  }

  public async getPendingBookingsByNumberAndQueueAndDate(
    queueId: string,
    date: string,
    number: number
  ): Promise<Booking[]> {
    if (queueId === undefined || date === undefined || number === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereEqualTo('number', number)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .find();
  }

  public async getPendingBookingsByDate(date: string, limit = 100): Promise<Booking[]> {
    if (date === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('date', date)
      .whereIn('status', [BookingStatus.PENDING])
      .orderByAscending('number')
      .limit(limit)
      .find();
  }

  public async getConfirmedBookingsByDate(date: string, limit = 100): Promise<Booking[]> {
    if (date === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('date', date)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .orderByAscending('number')
      .limit(limit)
      .find();
  }

  public async getConfirmedBookingsByCommerceIdDates(
    commerceId: string,
    dates: string[],
    limit = 200
  ): Promise<Booking[]> {
    if (commerceId === undefined || dates === undefined || dates.length === 0) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('commerceId', commerceId)
      .whereIn('date', dates)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereNotEqualTo('confirmNotified', true)
      .orderByAscending('number')
      .limit(limit)
      .find();
  }

  public async getBookingsBeforeYouByDate(
    number: number,
    queueId: string,
    date: string
  ): Promise<Booking[]> {
    if (queueId === undefined || date === undefined || number === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('date', date)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereLessThan('number', number)
      .find();
  }

  public async getPendingBookingsByClient(
    commerceId: string,
    idNumber: string,
    clientId: string
  ): Promise<Booking[]> {
    let results: Booking[] = [];
    if (clientId && commerceId !== undefined) {
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
          });
        }
      }
      return results;
    }
  }

  public async getPendingBookingsBetweenDates(
    queueId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<BookingAvailabilityDto[]> {
    if (queueId === undefined || dateFrom === undefined || dateTo === undefined) {
      return [];
    }
    const startDate = new Date(dateFrom).toISOString().slice(0, 10);
    const endDate = new Date(dateTo).toISOString().slice(0, 10);
    const dateFromValue = new Date(startDate);
    const dateToValue = new Date(endDate);
    const bookings: BookingAvailabilityDto[] = [];
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
        booking.block = result.block;
        bookings.push(booking);
      });
    }
    return bookings;
  }

  public async getPendingCommerceBookingsByDate(
    commerceId: string,
    date: string
  ): Promise<Booking[]> {
    if (commerceId === undefined || date === undefined) {
      return [];
    }
    return await this.bookingRepository
      .whereEqualTo('commerceId', commerceId)
      .whereIn('status', [BookingStatus.PENDING, BookingStatus.CONFIRMED])
      .whereEqualTo('date', date)
      .find();
  }

  public async getPendingCommerceBookingsBetweenDates(
    commerceId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<BookingAvailabilityDto[]> {
    if (commerceId === undefined || dateFrom === undefined || dateTo === undefined) {
      return [];
    }
    const startDate = new Date(dateFrom).toISOString().slice(0, 10);
    const endDate = new Date(dateTo).toISOString().slice(0, 10);
    const dateFromValue = new Date(startDate);
    const dateToValue = new Date(endDate);
    const bookings: BookingAvailabilityDto[] = [];
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
        booking.block = result.block;
        bookings.push(booking);
      });
    }
    return bookings;
  }

  public async getPendingBookingsBeforeDate(dateTo: Date): Promise<Booking[]> {
    if (dateTo === undefined) {
      return [];
    }
    const endDate = new Date(dateTo).toISOString().slice(0, 10);
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
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      booking.commerceId,
      FeatureToggleName.EMAIL
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'email-booking')) {
      toNotify.push(booking);
    }
    const notified = [];
    const commerceLanguage = bookingCommerce.localeInfo.language;
    toNotify.forEach(async booking => {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        if (booking.user.email) {
          const template = `${NotificationTemplate.BOOKING}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          const logo = await this.getCommerceLogoForEmail(booking.commerceId);
          const bookingNumber = booking.number;
          const bookingDate = booking.date;
          // Handle block - it can be undefined or have different structures
          let bookingblock = '';
          if (booking.block) {
            // If block has direct hourFrom/hourTo
            if (booking.block.hourFrom && booking.block.hourTo) {
              bookingblock = `${booking.block.hourFrom} - ${booking.block.hourTo}`;
            }
            // If block has nested blocks array, use the first one
            else if (booking.block.blocks && booking.block.blocks.length > 0) {
              const firstBlock = booking.block.blocks[0];
              if (firstBlock.hourFrom && firstBlock.hourTo) {
                bookingblock = `${firstBlock.hourFrom} - ${firstBlock.hourTo}`;
              }
            }
          }
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

  public async bookingCommerceConditionsEmail(booking: Booking): Promise<Booking[]> {
    const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      booking.commerceId,
      FeatureToggleName.EMAIL
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'email-bookings-terms-conditions')) {
      toNotify.push(booking);
    }
    const notified = [];
    const commerceLanguage = bookingCommerce.localeInfo.language;
    toNotify.forEach(async booking => {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        if (booking.user.email) {
          let documentAttachament: Attachment;
          const document = await this.documentsService.getDocument(
            `${bookingCommerce.id}.pdf`,
            'terms_of_service'
          );
          if (document) {
            const chunks = [];
            document.on('data', function (chunk) {
              chunks.push(chunk);
            });
            let content;
            await document.on('end', async () => {
              content = Buffer.concat(chunks);
              documentAttachament = {
                content,
                filename: `terms_of_service-${bookingCommerce.name}.pdf`,
                encoding: 'base64',
              };
              const from = process.env.EMAIL_SOURCE;
              const to = [booking.user.email];
              const emailData = NOTIFICATIONS.getBookingCommerceConditions(
                commerceLanguage,
                bookingCommerce
              );
              const subject = emailData.subject;
              const htmlTemplate = emailData.html;
              const attachments = [documentAttachament];
              const logo = await this.getCommerceLogoForEmail(booking.commerceId);
              const commerce = bookingCommerce.name;
              const link = `${process.env.BACKEND_URL}/interno/acceptterms/booking/${booking.id}/${booking.termsConditionsToAcceptCode}`;
              const html = htmlTemplate
                .replaceAll('{{logo}}', logo)
                .replaceAll('{{link}}', link)
                .replaceAll('{{commerce}}', commerce);
              await this.notificationService.createBookingRawEmailNotification(
                NotificationType.BOOKING_COMMERCE_CONDITIONS,
                booking.id,
                bookingCommerce.id,
                from,
                to,
                subject,
                attachments,
                html
              );
              notified.push(booking);
            });
          }
        }
      }
    });
    return notified;
  }

  public async bookingConfirmEmail(
    bookingCommerce: Commerce,
    booking: Booking
  ): Promise<Booking[]> {
    const featureToggle = bookingCommerce.features;
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'booking-email-confirm')) {
      toNotify.push(booking);
    }
    const notified = [];
    const commerceLanguage = bookingCommerce.localeInfo.language;
    if (toNotify.length === 1) {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        if (booking.user && booking.user.email) {
          const template = `${NotificationTemplate.BOOKING_CONFIRM}-${commerceLanguage}`;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          const logo = await this.getCommerceLogoForEmail(booking.commerceId);
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
    }
    return notified;
  }

  public async bookingWhatsapp(booking: Booking): Promise<Booking[]> {
    const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
    const featureToggle = await this.featureToggleService.getFeatureToggleByCommerceAndType(
      booking.commerceId,
      FeatureToggleName.WHATSAPP
    );
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'whatsapp-booking')) {
      toNotify.push(booking);
    }
    const notified = [];
    let message = '';
    let type;
    if (toNotify.length === 1) {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        const user = booking.user;
        if (user && user.notificationOn) {
          const bookingDate = getDateDDMMYYYY(booking.date);
          type = NotificationType.BOOKING;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          let linkWs = undefined;
          if (
            bookingCommerce &&
            bookingCommerce.contactInfo &&
            bookingCommerce.contactInfo.whatsapp
          ) {
            linkWs = `https://wa.me/${bookingCommerce.contactInfo.whatsapp}`;
          }
          const commerceLanguage = bookingCommerce.localeInfo.language;
          message = NOTIFICATIONS.getBookingMessage(
            commerceLanguage,
            bookingCommerce,
            booking,
            bookingDate,
            link,
            linkWs
          );
          let servicePhoneNumber = undefined;
          let whatsappConnection;
          if (
            bookingCommerce.whatsappConnection &&
            bookingCommerce.whatsappConnection.connected === true &&
            bookingCommerce.whatsappConnection.whatsapp
          ) {
            whatsappConnection = bookingCommerce.whatsappConnection;
          }
          if (
            whatsappConnection &&
            whatsappConnection.connected === true &&
            whatsappConnection.whatsapp
          ) {
            servicePhoneNumber = whatsappConnection.whatsapp;
          }
          this.notificationService.createBookingWhatsappNotification(
            user.phone,
            booking.id,
            message,
            type,
            booking.id,
            booking.commerceId,
            booking.queueId,
            servicePhoneNumber
          );
          notified.push(booking);
        }
      }
    }
    return notified;
  }

  public async bookingConfirmWhatsapp(
    bookingCommerce: Commerce,
    booking: Booking
  ): Promise<Booking[]> {
    const featureToggle = bookingCommerce.features;
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'booking-whatsapp-confirm')) {
      toNotify.push(booking);
    }
    const notified = [];
    let message = '';
    let type;
    if (toNotify.length === 1) {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        const user = booking.user;
        if (user && user.notificationOn) {
          const bookingDate = getDateDDMMYYYY(booking.date);
          type = NotificationType.BOOKING_CONFIRM;
          const link = `${process.env.BACKEND_URL}/interno/booking/${booking.id}`;
          const commerceLanguage = bookingCommerce.localeInfo.language;
          message = NOTIFICATIONS.getBookingConfirmMessage(
            commerceLanguage,
            bookingCommerce,
            booking,
            bookingDate,
            link
          );
          let servicePhoneNumber = undefined;
          let whatsappConnection;
          if (
            bookingCommerce.whatsappConnection &&
            bookingCommerce.whatsappConnection.connected === true &&
            bookingCommerce.whatsappConnection.whatsapp
          ) {
            whatsappConnection = bookingCommerce.whatsappConnection;
          }
          if (
            whatsappConnection &&
            whatsappConnection.connected === true &&
            whatsappConnection.whatsapp
          ) {
            servicePhoneNumber = whatsappConnection.whatsapp;
          }
          this.notificationService.createWhatsappNotification(
            user.phone,
            booking.id,
            message,
            type,
            booking.id,
            booking.commerceId,
            booking.queueId,
            servicePhoneNumber
          );
          notified.push(booking);
        }
      }
    }
    return notified;
  }

  public async bookingCancelWhatsapp(booking: Booking): Promise<Booking[]> {
    const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
    const featureToggle = bookingCommerce.features;
    const toNotify = [];
    if (this.featureToggleIsActive(featureToggle, 'booking-whatsapp-cancel')) {
      toNotify.push(booking);
    }
    const notified = [];
    let message = '';
    let type;
    if (toNotify.length === 1) {
      if (booking !== undefined && booking.type === BookingType.STANDARD) {
        const user = booking.user;
        if (user && user.notificationOn) {
          const bookingDate = getDateDDMMYYYY(booking.date);
          type = NotificationType.BOOKING_CANCELLED;
          const link = `${process.env.BACKEND_URL}/interno/comercio/${bookingCommerce.keyName}`;
          const commerceLanguage = bookingCommerce.localeInfo.language;
          message = NOTIFICATIONS.getBookingCancelledMessage(
            commerceLanguage,
            bookingCommerce,
            bookingDate,
            link
          );
          let servicePhoneNumber = undefined;
          let whatsappConnection;
          if (
            bookingCommerce.whatsappConnection &&
            bookingCommerce.whatsappConnection.connected === true &&
            bookingCommerce.whatsappConnection.whatsapp
          ) {
            whatsappConnection = bookingCommerce.whatsappConnection;
          }
          if (
            whatsappConnection &&
            whatsappConnection.connected === true &&
            whatsappConnection.whatsapp
          ) {
            servicePhoneNumber = whatsappConnection.whatsapp;
          }
          await this.notificationService.createWhatsappNotification(
            user.phone,
            booking.id,
            message,
            type,
            booking.id,
            booking.commerceId,
            booking.queueId,
            servicePhoneNumber
          );
          notified.push(booking);
        }
      }
    }
    return notified;
  }

  public async getBookingDetails(id: string): Promise<BookingDetailsDto> {
    try {
      const booking = await this.getBookingById(id);


      const bookingDetailsDto: BookingDetailsDto = new BookingDetailsDto();

      // Debug: Log booking block
      console.log('[BookingService.getBookingDetails] Booking ID:', id);
      console.log('[BookingService.getBookingDetails] Booking block from repository:', JSON.stringify(booking.block, null, 2));

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
      bookingDetailsDto.cancelledAt = booking.cancelledAt;
      bookingDetailsDto.cancelled = booking.cancelled;
      bookingDetailsDto.attentionId = booking.attentionId;

      // Explicitly assign block - ensure it's included even if undefined
      bookingDetailsDto.block = booking.block || undefined;

      console.log('[BookingService.getBookingDetails] Booking object keys:', Object.keys(booking));
      console.log('[BookingService.getBookingDetails] Booking has block property:', 'block' in booking);
      console.log('[BookingService.getBookingDetails] Booking.block value:', booking.block);
      console.log('[BookingService.getBookingDetails] Booking.block type:', typeof booking.block);
      console.log('[BookingService.getBookingDetails] DTO block assigned:', JSON.stringify(bookingDetailsDto.block, null, 2));
      bookingDetailsDto.telemedicineSessionId = booking.telemedicineSessionId;
      bookingDetailsDto.telemedicineConfig = booking.telemedicineConfig;
      bookingDetailsDto.professionalId = booking.professionalId;
      bookingDetailsDto.professionalName = booking.professionalName;
      // Map professional commission fields
      bookingDetailsDto.professionalCommissionType = booking.professionalCommissionType;
      bookingDetailsDto.professionalCommissionValue = booking.professionalCommissionValue;
      bookingDetailsDto.professionalCommissionAmount = booking.professionalCommissionAmount;
      bookingDetailsDto.professionalCommissionNotes = booking.professionalCommissionNotes;
      if (booking.queueId) {
        bookingDetailsDto.queue = await this.queueService.getQueueById(booking.queueId);
        bookingDetailsDto.commerce = await this.commerceService.getCommerceById(
          bookingDetailsDto.queue.commerceId
        );
        delete bookingDetailsDto.commerce.queues;
      }
      const booked = await this.getBookingsBeforeYouByDate(
        booking.number,
        booking.queueId,
        booking.date
      );
      if (booked) {
        bookingDetailsDto.beforeYou = booked.length || 0;
      }
      console.log('[BookingService.getBookingDetails] Final DTO block:', JSON.stringify(bookingDetailsDto.block, null, 2));
      console.log('[BookingService.getBookingDetails] Final DTO (full):', JSON.stringify({
        id: bookingDetailsDto.id,
        block: bookingDetailsDto.block,
        date: bookingDetailsDto.date
      }, null, 2));
      return bookingDetailsDto;
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al obtener detalles de la reserva: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async update(user: string, booking: Booking): Promise<Booking> {
    const bookingUpdated = await this.bookingRepository.update(booking);
    const bookingUpdatedEvent = new BookingUpdated(new Date(), bookingUpdated, { user });
    this.logger.log(`[BookingService] Publishing BookingUpdated event for booking ${bookingUpdated.id} with status ${bookingUpdated.status}`);
    publish(bookingUpdatedEvent);
    return bookingUpdated;
  }

  public async cancelBooking(user: string, id: string): Promise<Booking> {
    let booking = undefined;
    try {
      booking = await this.getBookingById(id);
      if (booking && booking.id) {
        booking.status = BookingStatus.RESERVE_CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancelled = true;
        const bookingCancelled = await this.update(user, booking);

        // Cancel telemedicine session if exists
        if (bookingCancelled.telemedicineSessionId) {
          try {
            await this.telemedicineService.cancelSession(
              bookingCancelled.telemedicineSessionId,
              user
            );
            this.logger.log(
              `[BookingService] Cancelled telemedicine session ${bookingCancelled.telemedicineSessionId} for cancelled booking ${bookingCancelled.id}`
            );
          } catch (error) {
            this.logger.error(
              `[BookingService] Failed to cancel telemedicine session ${bookingCancelled.telemedicineSessionId}: ${error.message}`
            );
            // Don't throw, continue with booking cancellation
          }
        }

        this.bookingBlockNumbersUsedService.deleteTakenBookingsBlocksByDate(
          undefined,
          booking.queueId,
          booking.date,
          booking.block
        );
        await this.waitlistService.notifyWaitListFormCancelledBooking(bookingCancelled);
        await this.bookingCancelWhatsapp(bookingCancelled);
        const packs = await this.packageService.getPackageByCommerceIdAndClientId(
          bookingCancelled.commerceId,
          bookingCancelled.clientId
        );
        if (packs && packs.length > 0) {
          for (let i = 0; i < packs.length; i++) {
            const pack = packs[i];
            await this.packageService.removeProcedureToPackage(
              user,
              pack.id,
              bookingCancelled.id,
              bookingCancelled.attentionId
            );
          }
        }
        booking = bookingCancelled;
        this.logger.info('Booking cancelled successfully', {
          bookingId: id,
          commerceId: booking.commerceId,
          queueId: booking.queueId,
          clientId: booking.clientId,
          user,
        });
      } else {
        throw new HttpException(`Booking no existe`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        bookingId: id,
        user,
      });
      throw new HttpException(
        `Hubo un problema al cancelar la reserva: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return booking;
  }

  public async confirmBooking(
    user: string,
    id: string,
    confirmationData: PaymentConfirmation
  ): Promise<Booking> {
    try {
      let booking = await this.getBookingById(id);
      if (booking && booking.id) {
        const bookingCommerce = await this.commerceService.getCommerceById(booking.commerceId);
        const featureToggle = bookingCommerce.features;
        if (this.featureToggleIsActive(featureToggle, 'booking-confirm')) {
          booking.status = BookingStatus.CONFIRMED;
          booking.confirmedAt = new Date();
          booking.confirmed = true;

          // CRITICAL: Check if the booking is already marked as paid
          const alreadyPaid =
            booking.confirmed === true &&
            booking.confirmationData &&
            booking.confirmationData.paid === true;

          // CRITICAL: Check if the package is already paid
          // If the package is paid, all sessions are prepaid and should be marked as paid automatically
          let packageAlreadyPaid = false;
          if (booking.packageId) {
            try {
              const pack = await this.packageService.getPackageById(booking.packageId);
              if (pack && pack.paid === true) {
                packageAlreadyPaid = true;
              }
            } catch (error) {
              this.logger.warn(
                `[BookingService] Could not verify package payment status for package ${booking.packageId}: ${error.message}`,
              );
              // If we can't load the package, do not block the operation based on this flag
            }
          }

          const skipFinancialFlow = alreadyPaid || packageAlreadyPaid;

          // If the package is paid but the booking is not marked as paid, mark it automatically
          if (packageAlreadyPaid && !alreadyPaid && confirmationData) {
            confirmationData.paid = true;
            confirmationData.paymentAmount = 0;
            confirmationData.totalAmount = 0;
            if (!confirmationData.paymentComment) {
              confirmationData.paymentComment = 'Pago incluido en paquete prepagado';
            }
            confirmationData.processPaymentNow = true; // To ensure it's saved in confirmationData
            confirmationData.user = user || 'ett';
          }

          // GESTION DE PAQUETE
          let pack;
          if (confirmationData !== undefined) {
            if (confirmationData.packageId) {
              // Usuario seleccionó un paquete en PaymentForm
              pack = await this.packageService.addProcedureToPackage(
                user,
                confirmationData.packageId,
                [id],
                []
              );
            } else if (booking.packageId) {
              // La reserva ya tiene un packageId (creado en builder)
              // Usar ese paquete en lugar de crear uno nuevo
              pack = await this.packageService.addProcedureToPackage(
                user,
                booking.packageId,
                [id],
                []
              );
            } else if (
              confirmationData.procedureNumber === 1 &&
              confirmationData.proceduresTotalNumber > 1
            ) {
              // Solo crear nuevo paquete si realmente no hay uno asociado
              let packageName;
              if (booking.servicesDetails && booking.servicesDetails.length > 0) {
                const names = booking.servicesDetails.map(service => service['tag']);
                if (names && names.length > 0) {
                  packageName = names.join('/').toLocaleUpperCase();
                }
              }
              pack = await this.packageService.createPackage(
                user,
                booking.commerceId,
                booking.clientId,
                id,
                undefined,
                confirmationData.proceduresTotalNumber,
                packageName,
                booking.servicesId,
                [id],
                [],
                PackageType.STANDARD,
                PackageStatus.CONFIRMED
              );
            }
          }
          if (pack && pack.id) {
            booking.packageId = pack.id;
            booking.packageProceduresTotalNumber = pack.proceduresAmount;
            booking.packageProcedureNumber = confirmationData.procedureNumber;
          }
          if (this.featureToggleIsActive(featureToggle, 'booking-confirm-payment')) {
            const packageId = pack && pack.id ? pack.id : undefined;
            if (confirmationData.processPaymentNow) {
              // If package is already paid, paymentAmount can be 0 (it's included in the package)
              // Otherwise, validate that payment data is complete
              if (!skipFinancialFlow) {
                if (
                  confirmationData === undefined ||
                  confirmationData.paid === false ||
                  !confirmationData.paymentDate ||
                  confirmationData.paymentAmount === undefined ||
                  confirmationData.paymentAmount < 0
                ) {
                  throw new HttpException(
                    `Datos insuficientes para confirmar el pago de la reserva`,
                    HttpStatus.INTERNAL_SERVER_ERROR
                  );
                }
              } else if (packageAlreadyPaid) {
                // If package is paid, ensure paymentAmount is 0 if not provided
                if (confirmationData && confirmationData.paymentAmount === undefined) {
                  confirmationData.paymentAmount = 0;
                }
                if (confirmationData && confirmationData.totalAmount === undefined) {
                  confirmationData.totalAmount = 0;
                }
                // Set paymentDate if not provided
                if (confirmationData && !confirmationData.paymentDate) {
                  confirmationData.paymentDate = new Date();
                }
              }
              confirmationData.user = user ? user : 'ett';
              booking.confirmationData = confirmationData;
              booking.confirmedBy = user;

              // GESTION DE ENTRADA EN CAJA
              // Si el paquete está pagado o ya estaba pagado, no crear Income
              if (skipFinancialFlow) {
                // Solo guardar confirmationData sin crear Income
                // El booking ya está marcado como paid arriba
                // No crear Income cuando el paquete está pagado
              } else if (confirmationData !== undefined && !packageAlreadyPaid) {
                let income;

                // Obtener datos del profesional si existe professionalId
                let professionalName = null;
                let professionalCommissionType = null;
                let professionalCommissionValue = null;
                let professionalCommissionNotes = null;

                if (confirmationData.professionalId) {
                  try {
                    const professional = await this.professionalService.getProfessionalById(confirmationData.professionalId);
                    if (professional) {
                      professionalName = professional.personalInfo?.name || booking.professionalName || null;
                      professionalCommissionType = confirmationData.professionalCommissionType ||
                        professional.financialInfo?.commissionType || null;
                      professionalCommissionValue = confirmationData.professionalCommissionValue ||
                        professional.financialInfo?.commissionValue || null;
                      professionalCommissionNotes = confirmationData.professionalCommissionNotes ||
                        `Comisión del profesional ${professionalName}` || null;
                    }
                  } catch (error) {
                    this.logger.warn(`No se pudo obtener datos del profesional ${confirmationData.professionalId}: ${error.message}`);
                    // Usar datos disponibles en confirmationData
                    professionalName = booking.professionalName || null;
                    professionalCommissionType = confirmationData.professionalCommissionType || null;
                    professionalCommissionValue = confirmationData.professionalCommissionValue || null;
                    professionalCommissionNotes = confirmationData.professionalCommissionNotes || null;
                  }
                }
                if (confirmationData.pendingPaymentId) {
                  income = await this.incomeService.payPendingIncome(
                    user,
                    confirmationData.pendingPaymentId,
                    confirmationData.paymentAmount,
                    confirmationData.paymentMethod,
                    confirmationData.paymentCommission,
                    confirmationData.paymentComment,
                    confirmationData.paymentFiscalNote,
                    confirmationData.promotionalCode,
                    confirmationData.transactionId,
                    confirmationData.bankEntity
                  );
                } else {
                  if (confirmationData.installments && confirmationData.installments > 1) {
                    income = await this.incomeService.createIncomes(
                      user,
                      booking.commerceId,
                      IncomeStatus.CONFIRMED,
                      booking.id,
                      undefined,
                      booking.clientId,
                      packageId,
                      confirmationData.paymentAmount,
                      confirmationData.totalAmount,
                      confirmationData.installments,
                      confirmationData.paymentMethod,
                      confirmationData.paymentCommission,
                      confirmationData.paymentComment,
                      confirmationData.paymentFiscalNote,
                      confirmationData.promotionalCode,
                      confirmationData.transactionId,
                      confirmationData.bankEntity,
                      confirmationData.confirmInstallments,
                      { user },
                      confirmationData.professionalId,
                      confirmationData.professionalCommissionAmount,
                      professionalName,
                      professionalCommissionType,
                      professionalCommissionValue,
                      professionalCommissionNotes,
                      booking.servicesId,
                      booking.servicesDetails
                    );
                  } else {
                    if (!packageId || !pack.paid || pack.paid === false) {
                      income = await this.incomeService.createIncome(
                        user,
                        booking.commerceId,
                        IncomeType.UNIQUE,
                        IncomeStatus.CONFIRMED,
                        booking.id,
                        undefined,
                        booking.clientId,
                        packageId,
                        confirmationData.paymentAmount,
                        confirmationData.totalAmount,
                        confirmationData.installments,
                        confirmationData.paymentMethod,
                        confirmationData.paymentCommission,
                        confirmationData.paymentComment,
                        confirmationData.paymentFiscalNote,
                        confirmationData.promotionalCode,
                        confirmationData.transactionId,
                        confirmationData.bankEntity,
                        { user },
                        undefined,
                        confirmationData.professionalId,
                        confirmationData.professionalCommissionAmount,
                        professionalName,
                        professionalCommissionType,
                        professionalCommissionValue,
                        professionalCommissionNotes,
                        booking.servicesId,
                        booking.servicesDetails
                      );
                    }
                  }
                }
                if (income && income.id) {
                  if (packageId) {
                    await this.packageService.payPackage(user, packageId, [income.id]);
                  }
                }
              }
            } else {
              confirmationData.paid = false;
              booking.confirmationData = confirmationData;
            }
          } else if (skipFinancialFlow && packageAlreadyPaid) {
            // Si el paquete está pagado pero no se procesó pago, guardar confirmationData
            if (confirmationData) {
              confirmationData.user = user || 'ett';
              booking.confirmationData = confirmationData;
            }
          }
          booking = await this.update(user, booking);
          const timezone = bookingCommerce.localeInfo.timezone || 'America/Sao_Paulo';
          const todayTimezone = new Date()
            .toLocaleString('en-US', { timeZone: timezone })
            .slice(0, 10);
          const today = new Date(todayTimezone).toISOString().slice(0, 10);
          if (booking.date === today) {
            await this.createAttention(user, booking);
          }
          this.logger.info('Booking confirmed successfully', {
            bookingId: id,
            commerceId: booking.commerceId,
            queueId: booking.queueId,
            clientId: booking.clientId,
            hasPayment: !!confirmationData?.processPaymentNow,
            hasPackage: !!booking.packageId,
            user,
          });
        }
        return booking;
      }
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        bookingId: id,
        user,
        hasConfirmationData: !!confirmationData,
      });
      throw new HttpException(
        `Hubo un problema al confirmar la reserva: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async processBooking(
    user: string,
    booking: Booking,
    attentionId: string
  ): Promise<Booking> {
    const bookingToUpdate = booking;
    bookingToUpdate.processed = true;
    bookingToUpdate.processedAt = new Date();
    bookingToUpdate.status = BookingStatus.PROCESSED;
    bookingToUpdate.attentionId = attentionId;
    const bookingUpdated = await this.update(user, bookingToUpdate);
    return bookingUpdated;
  }

  private async createAttention(userIn: string, booking: Booking): Promise<Attention> {
    // Check if booking was already processed
    if (booking.processed) {
      throw new HttpException(
        `El booking ${booking.id} ya fue procesado`,
        HttpStatus.BAD_REQUEST
      );
    }
    if (booking.attentionId) {
      throw new HttpException(
        `El booking ${booking.id} ya tiene una atención asociada: ${booking.attentionId}`,
        HttpStatus.BAD_REQUEST
      );
    }
    // Validate booking date is today
    const commerce = await this.commerceService.getCommerceById(booking.commerceId);
    const timezone = commerce?.localeInfo?.timezone || 'America/Sao_Paulo';
    const todayTimezone = new Date()
      .toLocaleString('en-US', { timeZone: timezone })
      .slice(0, 10);
    const today = new Date(todayTimezone).toISOString().slice(0, 10);
    if (booking.date !== today) {
      throw new HttpException(
        `El booking ${booking.id} no puede procesarse porque la fecha (${booking.date}) no es hoy (${today})`,
        HttpStatus.BAD_REQUEST
      );
    }
    const {
      id,
      queueId,
      channel,
      user,
      block,
      confirmationData,
      servicesId,
      servicesDetails,
      clientId,
      termsConditionsToAcceptCode,
      termsConditionsAcceptedCode,
      termsConditionsToAcceptedAt,
      telemedicineConfig,
    } = booking;

    // Determinar tipo de atención basado en telemedicina
    const attentionType = telemedicineConfig ? AttentionType.TELEMEDICINE : undefined;

    // Normalizar telemedicineConfig si existe para asegurar formato correcto
    let normalizedTelemedicineConfig = undefined;
    if (telemedicineConfig) {
      normalizedTelemedicineConfig = {
        type: telemedicineConfig.type || 'video', // Asegurar que siempre sea 'video' (único tipo permitido ahora)
        scheduledAt:
          telemedicineConfig.scheduledAt instanceof Date
            ? telemedicineConfig.scheduledAt
            : new Date(telemedicineConfig.scheduledAt),
        recordingEnabled: telemedicineConfig.recordingEnabled,
        notes: telemedicineConfig.notes,
      };
    }

    // Debug: Log booking data before creating attention
    console.log('[BookingService.createAttention] Processing booking:', {
      bookingId: id,
      professionalId: booking.professionalId,
      hasConfirmationData: !!booking.confirmationData,
      confirmationDataPaid: booking.confirmationData?.paid,
      confirmationDataAmount: booking.confirmationData?.paymentAmount,
      professionalCommissionAmount: booking.confirmationData?.professionalCommissionAmount,
      fullConfirmationData: JSON.stringify(booking.confirmationData, null, 2)
    });

    console.log('🔥🔥🔥 [CRITICAL DEBUG] DATOS ENVIADOS AL AttentionService.createAttention():');
    console.log('  - queueId:', queueId);
    console.log('  - collaboratorId (booking.professionalId):', booking.professionalId);
    console.log('  - channel:', channel);
    console.log('  - paymentConfirmationData:', booking.confirmationData ? 'EXISTS' : 'UNDEFINED');
    if (booking.confirmationData) {
      console.log('  - paymentConfirmationData.paid:', booking.confirmationData.paid);
      console.log('  - paymentConfirmationData.paymentAmount:', booking.confirmationData.paymentAmount);
      console.log('  - paymentConfirmationData.professionalCommissionAmount:', booking.confirmationData.professionalCommissionAmount);
    }
    console.log('  - bookingId:', id);
    console.log('🔥🔥🔥 [CRITICAL DEBUG] FIN DATOS');

    const attention = await this.attentionService.createAttention(
      queueId,
      booking.professionalId, // Pasar el professionalId del booking como collaboratorId
      channel,
      user,
      attentionType,
      block,
      new Date(booking.date), // Pasar la fecha del booking
      booking.confirmationData, // Pasar los datos de confirmación del booking
      id,
      servicesId,
      servicesDetails,
      clientId,
      termsConditionsToAcceptCode,
      termsConditionsAcceptedCode,
      termsConditionsToAcceptedAt,
      normalizedTelemedicineConfig
    );

    // Si se creó sesión de telemedicina, vincular con booking
    if (attention.telemedicineSessionId) {
      booking.telemedicineSessionId = attention.telemedicineSessionId;
      await this.update(userIn, booking);
    }

    await this.processBooking(userIn, booking, attention.id);
    return attention;
  }

  public async processBookings(date: string): Promise<any> {
    if (!date) {
      throw new HttpException(`Error procesando Reservas: Fecha inválida`, HttpStatus.BAD_REQUEST);
    }
    const bookings = await this.getConfirmedBookingsByDate(date, 25);
    // Filter out already processed bookings to avoid processing same booking multiple times
    const bookingsToProcess = bookings.filter(booking =>
      !booking.processed && !booking.attentionId
    );
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 10,
    });
    const toProcess = bookingsToProcess.length;
    const responses = [];
    const errors = [];
    const processedBookingIds = new Set<string>(); // Track processed bookings to avoid duplicates
    if (bookingsToProcess && bookingsToProcess.length > 0) {
      for (let i = 0; i < bookingsToProcess.length; i++) {
        const booking = bookingsToProcess[i];
        // Skip if already being processed or already processed
        if (processedBookingIds.has(booking.id) || booking.processed || booking.attentionId) {
          continue;
        }
        processedBookingIds.add(booking.id);
        limiter.schedule(async () => {
          try {
            // Double-check booking hasn't been processed by another concurrent request
            const currentBooking = await this.getBookingById(booking.id);
            if (currentBooking.processed || currentBooking.attentionId) {
              return; // Skip if already processed
            }
            const attention = await this.createAttention('ett', currentBooking);
            responses.push(attention);
          } catch (error) {
            errors.push(error);
          }
        });
      }
      await limiter.stop({ dropWaitingJobs: false });
    }
    const response = { toProcess, processed: responses.length, errors: errors.length };
    this.logger.info('Bookings processed', {
      date,
      toProcess,
      processed: responses.length,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors.map(e => e.message || String(e)) : undefined,
    });
    return response;
  }

  public async processBookingById(user: string, id: string): Promise<any> {
    if (!id) {
      throw new HttpException(`Error procesando Reserva: Id inválido`, HttpStatus.BAD_REQUEST);
    }
    const booking = await this.getBookingById(id);
    const toProcess = 1;
    const responses = [];
    const errors = [];
    if (booking && booking.id) {
      // Validate booking is not already processed
      if (booking.processed) {
        throw new HttpException(
          `El booking ${booking.id} ya fue procesado`,
          HttpStatus.BAD_REQUEST
        );
      }
      if (booking.attentionId) {
        throw new HttpException(
          `El booking ${booking.id} ya tiene una atención asociada: ${booking.attentionId}`,
          HttpStatus.BAD_REQUEST
        );
      }
      // Validate booking date is today
      let timezone = 'America/Sao_Paulo';
      try {
        const commerce = await this.commerceService.getCommerceById(booking.commerceId);
        if (commerce?.localeInfo?.timezone) {
          timezone = commerce.localeInfo.timezone;
        }
      } catch (error) {
        // Use default timezone if commerce not found
      }
      const todayTimezone = new Date()
        .toLocaleString('en-US', { timeZone: timezone })
        .slice(0, 10);
      const today = new Date(todayTimezone).toISOString().slice(0, 10);
      if (booking.date !== today) {
        throw new HttpException(
          `El booking ${booking.id} no puede procesarse porque la fecha (${booking.date}) no es hoy (${today})`,
          HttpStatus.BAD_REQUEST
        );
      }
      try {
        const attention = await this.createAttention(user, booking);
        responses.push(attention);
      } catch (error) {
        errors.push(error);
      }
    }
    const response = { toProcess, processed: responses.length, errors: errors.length };
    this.logger.info('Booking processed by ID', {
      bookingId: id,
      toProcess,
      processed: responses.length,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors.map(e => e.message || String(e)) : undefined,
    });
    return response;
  }

  public async processPastBooking(
    bookingId: string,
    collaboratorId: string,
    commerceLanguage: string
  ): Promise<any> {
    const response = { booking: {}, attention: {}, processBooking: {}, attend: {}, finish: {} };
    try {
      const booking = await this.getBookingById(bookingId);
      response.booking = booking;
      if (booking && booking.id) {
        const { queueId, channel, user, block, date, telemedicineConfig } = booking;
        const dateOfAttention = new Date(date);

        // Determinar tipo de atención basado en telemedicina
        const attentionType = telemedicineConfig
          ? AttentionType.TELEMEDICINE
          : AttentionType.STANDARD;

        // Normalizar telemedicineConfig si existe para asegurar formato correcto
        let normalizedTelemedicineConfig = undefined;
        if (telemedicineConfig) {
          normalizedTelemedicineConfig = {
            type: telemedicineConfig.type || 'video', // Asegurar que siempre sea 'video' (único tipo permitido ahora)
            scheduledAt:
              telemedicineConfig.scheduledAt instanceof Date
                ? telemedicineConfig.scheduledAt
                : new Date(telemedicineConfig.scheduledAt),
            recordingEnabled: telemedicineConfig.recordingEnabled,
            notes: telemedicineConfig.notes,
          };
        }

        const attention = await this.attentionService.createAttention(
          queueId,
          collaboratorId,
          channel,
          user,
          attentionType,
          block,
          dateOfAttention,
          undefined,
          undefined,
          booking.servicesId,
          booking.servicesDetails,
          booking.clientId,
          undefined,
          undefined,
          undefined,
          normalizedTelemedicineConfig
        );
        response.attention = attention;
        if (attention && attention.id) {
          const { number } = attention;
          const processBooking = await this.processBooking('ett', booking, attention.id);
          response.processBooking = processBooking;
          const attend = await this.attentionService.attend(
            'ETT-MIGRATION',
            number,
            queueId,
            collaboratorId,
            commerceLanguage
          );
          const finish = await this.attentionService.finishAttention(
            'ett',
            attention.id,
            'MIGRATION',
            dateOfAttention
          );
          response.finish = finish;
          response.attend = attend;
        }
      }
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        bookingId,
        collaboratorId,
        commerceLanguage,
      });
    }
    this.logger.info('Past booking processed', {
      bookingId,
      collaboratorId,
      hasBooking: !!response.booking,
      hasAttention: !!response.attention,
      hasProcessBooking: !!response.processBooking,
      hasAttend: !!response.attend,
      hasFinish: !!response.finish,
    });
    return response;
  }

  public async createBookingFromWaitlist(
    waitlistId: string,
    blockNumber: number
  ): Promise<Booking> {
    let booking: Booking = undefined;
    let waitlist: Waitlist = undefined;
    if (waitlistId) {
      waitlist = await this.waitlistService.getWaitlistById(waitlistId);
      if (waitlist) {
        // Check if waitlist was already processed
        if (waitlist.status !== WaitlistStatus.PENDING) {
          throw new HttpException(
            `Error procesando Waitlist: Ya fue procesada`,
            HttpStatus.BAD_REQUEST
          );
        }
        if (waitlist.processed) {
          throw new HttpException(
            `Error procesando Waitlist: Ya fue procesada`,
            HttpStatus.BAD_REQUEST
          );
        }
        if (waitlist.bookingId) {
          throw new HttpException(
            `Error procesando Waitlist: Ya tiene un booking asociado: ${waitlist.bookingId}`,
            HttpStatus.BAD_REQUEST
          );
        }
        const queue = await this.queueService.getQueueById(waitlist.queueId);
        const blocks = queue.serviceInfo.blocks;
        let block = undefined;
        if (blocks && blocks.length > 0) {
          block = blocks.filter(block => {
            return block.number.toString() === blockNumber.toString();
          })[0];
        }
        if (!block) {
          throw new HttpException(
            `Bloque ${blockNumber} no encontrado en la fila`,
            HttpStatus.BAD_REQUEST
          );
        }

        // Validate block availability before creating booking
        // This will check if the block is already taken
        const sessionId = `waitlist-${waitlistId}`;
        const validateBlocks = await this.validateBookingBlocksToCreate(
          sessionId,
          queue,
          waitlist.date,
          block
        );
        if (!validateBlocks) {
          throw new HttpException(
            `El bloque ${blockNumber} ya está reservado`,
            HttpStatus.CONFLICT
          );
        }

        booking = await this.createBooking(
          waitlist.queueId,
          waitlist.channel,
          waitlist.date,
          waitlist.user,
          block,
          undefined,
          undefined,
          undefined,
          undefined,
          sessionId
        );
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

  public async confirmNotifyBookings(): Promise<any> {
    let bookings = [];
    const commerces = await this.commerceService.getCommercesDetails();
    if (commerces && commerces.length > 0) {
      for (let i = 0; i < commerces.length; i++) {
        const commerce = commerces[i];
        if (commerce && commerce.id) {
          const featureToggle = commerce.features;
          if (
            this.featureToggleIsActive(featureToggle, 'booking-email-confirm') ||
            this.featureToggleIsActive(featureToggle, 'booking-whatsapp-confirm')
          ) {
            let daysBefore = ['1'];
            if (commerce.serviceInfo && commerce.serviceInfo.confirmNotificationDaysBefore) {
              const rawDays = commerce.serviceInfo.confirmNotificationDaysBefore.split(',');
              const numericDays = rawDays
                .map(day => parseInt(day, 10))
                .filter(day => !isNaN(day) && day > 0)
                .sort((a, b) => a - b);
              if (numericDays && numericDays.length > 0) {
                daysBefore = numericDays.map(day => String(day));
              }
            }
            const dates = [];
            for (let i = 0; i < daysBefore.length; i++) {
              const days = daysBefore[i];
              const date = new DateModel().addDays(+days).toString();
              if (date !== new DateModel().toString()) {
                dates.push(date);
              }
            }
            const pendings = await this.getConfirmedBookingsByCommerceIdDates(
              commerce.id,
              dates,
              200
            );
            if (pendings && pendings.length > 0) {
              bookings = [...bookings, ...pendings];
            }
          }
        }
      }
    }
    bookings = bookings.filter(booking => {
      const createdDate = new DateModel(booking.createdAt.toISOString().slice(0, 10)).toString();
      const today = new DateModel().toString();
      if (createdDate && createdDate !== today) {
        return booking;
      }
    });
    if (!bookings || bookings.length === 0) {
      throw new HttpException(`Sin Reservas para confirmar`, HttpStatus.OK);
    }
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 10,
    });
    const toProcess = bookings.length;
    const responses = [];
    const errors = [];
    const emails = [];
    const messages = [];
    if (bookings && bookings.length > 0) {
      for (let i = 0; i < bookings.length; i++) {
        const booking = bookings[i];
        limiter.schedule(async () => {
          try {
            const bookingCommerces = commerces.filter(
              commerce => commerce.id === booking.commerceId
            );
            let bookingCommerce;
            if (bookingCommerces && bookingCommerces.length > 0) {
              bookingCommerce = bookingCommerces[0];
            }
            // Calcular en cuántos días más es la reserva y el mínimo configurado
            let minDaysBefore = 1;
            if (
              bookingCommerce &&
              bookingCommerce.serviceInfo &&
              bookingCommerce.serviceInfo.confirmNotificationDaysBefore
            ) {
              const rawDays =
                bookingCommerce.serviceInfo.confirmNotificationDaysBefore.split(',');
              const numericDays = rawDays
                .map(day => parseInt(day, 10))
                .filter(day => !isNaN(day) && day > 0);
              if (numericDays && numericDays.length > 0) {
                minDaysBefore = Math.min(...numericDays);
              }
            }
            const today = new DateModel();
            const bookingDateModel = new DateModel(booking.date);
            const daysUntilBooking = bookingDateModel.daysDiff(today);

            const email = await this.bookingConfirmEmail(bookingCommerce, booking);
            const message = await this.bookingConfirmWhatsapp(bookingCommerce, booking);
            if (email && email[0] && email[0].id) {
              booking.confirmNotifiedEmail = true;
              emails.push(email[0]);
            }
            if (message && message[0] && message[0].id) {
              booking.confirmNotifiedWhatsapp = true;
              messages.push(message[0]);
            }
            // Solo marcar como "confirmNotified" cuando estemos en el menor
            // número de días configurado antes de la reserva (por ejemplo, 1 día).
            if (daysUntilBooking === minDaysBefore) {
              booking.confirmNotified = true;
            }
            await this.update('ett', booking);
          } catch (error) {
            errors.push(error.message);
          }
          responses.push(booking);
        });
      }
      await limiter.stop({ dropWaitingJobs: false });
    }
    const response = {
      toProcess,
      processed: responses.length,
      emails: emails.length,
      messages: messages.length,
      errors: errors.length,
    };
    this.logger.info('Bookings confirmation notifications processed', {
      toProcess,
      processed: responses.length,
      emails: emails.length,
      messages: messages.length,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors.map(e => e.message || String(e)) : undefined,
    });
    return response;
  }

  public async cancelBookings(): Promise<any> {
    const limiter = new Bottleneck({
      minTime: 1000,
      maxConcurrent: 10,
    });
    const responses = [];
    const errors = [];
    let toProcess = 0;
    try {
      const bookings = await this.getPendingBookingsBeforeDate(new Date());
      toProcess = bookings.length;
      if (bookings && bookings.length > 0) {
        for (let i = 0; i < bookings.length; i++) {
          const booking = bookings[i];
          limiter.schedule(async () => {
            try {
              booking.status = BookingStatus.RESERVE_CANCELLED;
              booking.cancelledAt = new Date();
              booking.cancelled = true;
              const bookingCancelled = await this.update('ett', booking);

              // Cancel telemedicine session if exists
              if (bookingCancelled.telemedicineSessionId) {
                try {
                  await this.telemedicineService.cancelSession(
                    bookingCancelled.telemedicineSessionId,
                    'ett'
                  );
                  this.logger.log(
                    `[BookingService] Cancelled telemedicine session ${bookingCancelled.telemedicineSessionId} for cancelled booking ${bookingCancelled.id}`
                  );
                } catch (error) {
                  this.logger.error(
                    `[BookingService] Failed to cancel telemedicine session ${bookingCancelled.telemedicineSessionId}: ${error.message}`
                  );
                  // Don't throw, continue with booking cancellation
                }
              }
            } catch (error) {
              errors.push(error);
            }
            responses.push(booking);
          });
        }
        await limiter.stop({ dropWaitingJobs: false });
      }
      const response = { toProcess, processed: responses.length, errors: errors.length };
      this.logger.info('Bookings cancellation processed', {
        toProcess,
        processed: responses.length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors.map(e => e.message || String(e)) : undefined,
      });
      return response;
    } catch (error) {
      this.logger.logError(error instanceof Error ? error : new Error(String(error)), undefined, {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw new HttpException(
        `Hubo un poblema al cancelar las reservas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async transferBookingToQueue(user: string, id: string, queueId: string): Promise<Booking> {
    let booking = undefined;
    try {
      booking = await this.getBookingById(id);
      const queueIdFrom = booking.queueId;
      const queueToTransfer = await this.queueService.getQueueById(queueId);
      if (booking && booking.id) {
        if (queueToTransfer && queueToTransfer.id) {
          // Validate queue is active and available
          if (!queueToTransfer.active) {
            throw new HttpException(
              `La fila ${queueToTransfer.id} - ${queueToTransfer.name} no está activa`,
              HttpStatus.BAD_REQUEST
            );
          }
          if (!queueToTransfer.available) {
            throw new HttpException(
              `La fila ${queueToTransfer.id} - ${queueToTransfer.name} no está disponible`,
              HttpStatus.BAD_REQUEST
            );
          }
          // Validate queue limit is valid
          if (!queueToTransfer.limit || queueToTransfer.limit <= 0) {
            throw new HttpException(
              `Límite de la fila ${queueToTransfer.id} - ${queueToTransfer.name} no es válido`,
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
          // Check if target queue has available space
          const booked = await this.getPendingBookingsByQueueAndDate(queueId, booking.date);
          if (booked.length >= queueToTransfer.limit) {
            throw new HttpException(
              `Limite de la fila ${queueToTransfer.id} - ${queueToTransfer.name} (${queueToTransfer.limit}) alcanzado para la fecha ${booking.date}`,
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
          const validateBookingBlocks = await this.validateBookingBlocks(
            queueToTransfer,
            booking.date,
            booking.block
          );
          if (validateBookingBlocks === false) {
            throw new HttpException(
              `Al menos un bloque horario ya fue reservado`,
              HttpStatus.CONFLICT
            );
          }
          booking.transfered = true;
          booking.transferedAt = new Date();
          booking.transferedOrigin = booking.queueId;
          booking.queueId = queueId;
          booking.transferedCount = booking.transferedCount ? booking.transferedCount + 1 : 1;
          booking.transferedBy = user;
          booking = await this.update(user, booking);
          this.bookingBlockNumbersUsedService.editQueueTakenBookingsBlocksByDate(
            queueIdFrom,
            booking.date,
            booking.block,
            booking.queueId
          );
        } else {
          throw new HttpException(`Cola no existe: ${queueId}`, HttpStatus.NOT_FOUND);
        }
      } else {
        throw new HttpException(`Reserva no existe: ${id}`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Hubo un problema al transferir la reserva: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return booking;
  }

  /**
   * Assign a professional to a booking and calculate commission
   * @param user - User performing the assignment
   * @param bookingId - Booking ID
   * @param professionalId - Professional ID to assign
   * @returns Updated booking with professional assigned
   */
  public async assignProfessional(
    user: string,
    bookingId: string,
    professionalId: string,
    professionalName?: string,
    customCommission?: number,
    customCommissionType?: string
  ): Promise<Booking> {
    try {
      // Get booking
      const booking = await this.getBookingById(bookingId);
      if (!booking || !booking.id) {
        throw new HttpException(
          `Reserva no existe: ${bookingId}`,
          HttpStatus.NOT_FOUND
        );
      }

      // Get professional
      const professional = await this.professionalService.getProfessionalById(professionalId);
      if (!professional || !professional.id) {
        throw new HttpException(
          `Profesional no existe: ${professionalId}`,
          HttpStatus.NOT_FOUND
        );
      }

      // Validate professional belongs to the same commerce
      if (professional.commerceId !== booking.commerceId) {
        throw new HttpException(
          `El profesional no pertenece al mismo comercio de la reserva`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate professional is active and available
      if (!professional.active || !professional.available) {
        throw new HttpException(
          `El profesional no está activo o disponible para asignación`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate professional can perform the services
      if (booking.servicesId?.length > 0 &&
          professional.professionalInfo?.servicesId?.length > 0) {
        const hasAllServices = booking.servicesId.every(
          serviceId => professional.professionalInfo.servicesId.includes(serviceId)
        );
        if (!hasAllServices) {
          throw new HttpException(
            `El profesional no está habilitado para realizar todos los servicios de esta reserva`,
            HttpStatus.BAD_REQUEST
          );
        }
      }

      // Assign professional to booking
      booking.professionalId = professionalId;
      booking.professionalName = professionalName || professional.personalInfo?.name || 'N/I';

      // Si se proporciona una comisión personalizada, usarla; sino, usar la del profesional
      let commissionTypeToUse: string | undefined;
      let commissionValueToUse: number | undefined;

      if (customCommission !== undefined && customCommission !== null && customCommissionType) {
        // Usar comisión personalizada del usuario
        commissionTypeToUse = customCommissionType;
        commissionValueToUse = customCommission;
        this.logger.log(`[BookingService] Using custom commission: ${customCommission} (${customCommissionType})`);
      } else if (professional.financialInfo) {
        // Usar comisión del profesional
        commissionTypeToUse = professional.financialInfo.commissionType;
        commissionValueToUse = professional.financialInfo.commissionValue;
        this.logger.log(`[BookingService] Using professional default commission: ${commissionValueToUse} (${commissionTypeToUse})`);
      }

      // Si hay tipo y valor de comisión, guardarla en el booking
      if (commissionTypeToUse && commissionValueToUse && commissionValueToUse > 0) {
        this.logger.log(`[BookingService] Processing commission - Type: ${commissionTypeToUse}, Value: ${commissionValueToUse}`);

        // Calculate commission amount based on type (if totalAmount is available from existing confirmationData)
        let commissionAmount = 0;
        if (booking.confirmationData?.totalAmount) {
          if (commissionTypeToUse === 'PERCENTAGE') {
            commissionAmount = (booking.confirmationData.totalAmount * commissionValueToUse) / 100;
          } else if (commissionTypeToUse === 'FIXED') {
            commissionAmount = commissionValueToUse;
          }
        }

        // Save commission data directly in booking fields
        booking.professionalCommissionType = commissionTypeToUse;
        booking.professionalCommissionValue = commissionValueToUse;
        booking.professionalCommissionAmount = commissionAmount;
        booking.professionalCommissionNotes = customCommission !== undefined && customCommission !== null
          ? `Comisión personalizada: ${commissionValueToUse}${commissionTypeToUse === 'PERCENTAGE' ? '%' : ' BRL'}`
          : `Comisión auto-sugerida del profesional ${professional.personalInfo?.name || professionalId}`;

        this.logger.log(`[BookingService] Commission data set in booking fields:`, JSON.stringify({
          professionalCommissionType: booking.professionalCommissionType,
          professionalCommissionValue: booking.professionalCommissionValue,
          professionalCommissionAmount: booking.professionalCommissionAmount,
          professionalCommissionNotes: booking.professionalCommissionNotes
        }));

        // También guardar en confirmationData si existe (para mantener compatibilidad)
        if (booking.confirmationData) {
          booking.confirmationData.professionalId = professionalId;
          booking.confirmationData.professionalCommissionType = commissionTypeToUse;
          booking.confirmationData.professionalCommissionValue = commissionValueToUse;
          booking.confirmationData.professionalCommissionAmount = commissionAmount;
          booking.confirmationData.professionalCommissionPercentage = commissionTypeToUse === 'PERCENTAGE' ? commissionValueToUse : 0;
          booking.confirmationData.professionalCommissionNotes = booking.professionalCommissionNotes;
          this.logger.log(`[BookingService] Also saved commission in confirmationData for compatibility`);
        }
      } else {
        this.logger.log(`[BookingService] No commission to process - Type: ${commissionTypeToUse}, Value: ${commissionValueToUse}`);
      }

      // Update booking
      this.logger.log(`[BookingService] About to update booking with commission data:`, {
        professionalId: booking.professionalId,
        professionalName: booking.professionalName,
        professionalCommissionType: booking.professionalCommissionType,
        professionalCommissionValue: booking.professionalCommissionValue,
        confirmationData: booking.confirmationData ? 'exists' : 'null'
      });
      const updatedBooking = await this.update(user, booking);
      this.logger.log(`[BookingService] After update - commission data:`, {
        professionalCommissionType: updatedBooking.professionalCommissionType,
        professionalCommissionValue: updatedBooking.professionalCommissionValue,
        professionalCommissionAmount: updatedBooking.professionalCommissionAmount
      });

      // Debug: Log what we're getting back
      this.logger.log(`[BookingService] Before update - ID: ${booking.professionalId}, Name: ${booking.professionalName}`);
      this.logger.log(`[BookingService] After update - ID: ${updatedBooking.professionalId}, Name: ${updatedBooking.professionalName}`);

      // Ensure professionalId and professionalName are set in the response
      this.logger.log(`[BookingService] Professional assigned - ID: ${booking.professionalId}, Name: ${booking.professionalName}`);
      updatedBooking.professionalId = booking.professionalId;
      updatedBooking.professionalName = booking.professionalName;

      this.logger.log(`[BookingService] Final response - ID: ${updatedBooking.professionalId}, Name: ${updatedBooking.professionalName}`);

      // Get commerce and queue for event metadata
      const queue = await this.queueService.getQueueById(booking.queueId);
      const businessId = queue?.commerceId || booking.clientId;

      // Publish event
      const event = new ProfessionalAssignedToBooking(
        bookingId,
        professionalId,
        businessId,
        booking.commerceId,
        booking.userId,
        user,
        booking.servicesId?.[0], // First service if multiple
        booking.confirmationData?.professionalCommissionType,
        booking.confirmationData?.professionalCommissionValue,
        booking.confirmationData?.professionalCommissionAmount
      );

      await publish('professional-assigned-to-booking', event, {
        bookingId,
        professionalId,
        businessId,
        commerceId: booking.commerceId
      });

      return updatedBooking;
    } catch (error) {
      this.logger.error(
        `Error assigning professional to booking: bookingId=${bookingId}, professionalId=${professionalId}, error=${error.message}`
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Hubo un problema al asignar el profesional: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async editBookingDateAndBlock(
    user: string,
    id: string,
    date: string,
    block: Block,
    telemedicineConfig?: {
      type: 'VIDEO' | 'CHAT' | 'BOTH';
      scheduledAt: string;
      recordingEnabled?: boolean;
      notes?: string;
    }
  ): Promise<Booking> {
    let booking = undefined;
    try {
      booking = await this.getBookingById(id);
      if (booking && booking.id) {
        if (date && block) {
          // Validate date format
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(date)) {
            throw new HttpException(
              `Formato de fecha inválido: ${date}. Debe ser YYYY-MM-DD`,
              HttpStatus.BAD_REQUEST
            );
          }
          const [year, month, day] = date.split('-');
          const yearNum = parseInt(year, 10);
          const monthNum = parseInt(month, 10);
          const dayNum = parseInt(day, 10);

          // Validate date values
          if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum) ||
              monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
            throw new HttpException(
              `Fecha inválida: ${date}`,
              HttpStatus.BAD_REQUEST
            );
          }

          const dateFormatted = new Date(yearNum, monthNum - 1, dayNum);
          // Verify date is valid (not adjusted by Date constructor)
          if (dateFormatted.getFullYear() !== yearNum ||
              dateFormatted.getMonth() !== monthNum - 1 ||
              dateFormatted.getDate() !== dayNum) {
            throw new HttpException(
              `Fecha inválida: ${date}`,
              HttpStatus.BAD_REQUEST
            );
          }

          // Validate date is not in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const bookingDate = new Date(dateFormatted);
          bookingDate.setHours(0, 0, 0, 0);
          if (bookingDate < today) {
            throw new HttpException(
              `No se puede editar la reserva a una fecha pasada: ${date}`,
              HttpStatus.BAD_REQUEST
            );
          }

          const queue = await this.queueService.getQueueById(booking.queueId);
          const validateBookingBlocks = await this.validateBookingBlocks(queue, date, block);
          if (validateBookingBlocks === false) {
            throw new HttpException(
              `Al menos un bloque horario ya fue reservado`,
              HttpStatus.CONFLICT
            );
          }
          const dateFrom = booking.date;
          const blockFrom = booking.block;
          const dateTo = date;
          const blockTo = block;
          booking.edited = true;
          booking.editedAt = new Date();
          booking.editedDateOrigin = booking.date;
          booking.editedBlockOrigin = booking.block;
          booking.date = date;
          booking.dateFormatted = dateFormatted;
          booking.block = block;

          // Update telemedicine config if provided
          if (telemedicineConfig) {
            // Convert type to lowercase to match entity format
            const configType = telemedicineConfig.type?.toLowerCase() as 'video' | 'chat' | 'both';
            const scheduledAt = telemedicineConfig.scheduledAt
              ? new Date(telemedicineConfig.scheduledAt)
              : new Date();

            // Validate scheduledAt is in the future
            const now = new Date();
            if (scheduledAt <= now) {
              throw new HttpException(
                `La fecha de telemedicina debe ser en el futuro. Fecha proporcionada: ${scheduledAt.toISOString()}`,
                HttpStatus.BAD_REQUEST
              );
            }

            booking.telemedicineConfig = {
              type: configType || 'video',
              scheduledAt: scheduledAt,
              recordingEnabled: telemedicineConfig.recordingEnabled || false,
              notes: telemedicineConfig.notes || '',
            };
            // Update booking type if telemedicine config is provided
            if (!booking.type || booking.type === BookingType.STANDARD) {
              booking.type = BookingType.TELEMEDICINE;
            }
          } else if (block && booking.telemedicineConfig) {
            // If telemedicine config exists but not provided in update, update scheduledAt based on new block
            // This ensures the scheduled time matches the new block time
            if (block.hourFrom) {
              const dateStr =
                typeof date === 'string' ? date : new Date(date).toISOString().slice(0, 10);
              const scheduledDateTime = new Date(dateStr + 'T' + block.hourFrom + ':00');
              // Validate scheduledAt is in the future
              const now = new Date();
              if (scheduledDateTime <= now) {
                throw new HttpException(
                  `La fecha de telemedicina debe ser en el futuro. Fecha calculada: ${scheduledDateTime.toISOString()}`,
                  HttpStatus.BAD_REQUEST
                );
              }
              booking.telemedicineConfig.scheduledAt = scheduledDateTime;
            }
          }

          booking.editedCount = booking.editedCount ? booking.editedCount + 1 : 1;
          booking.editedBy = user;
          booking = await this.update(user, booking);
          this.bookingBlockNumbersUsedService.editHourAndDateTakenBookingsBlocksByDate(
            queue.id,
            dateFrom,
            blockFrom,
            dateTo,
            blockTo
          );
        } else {
          throw new HttpException(
            `Datos para editar no son correctos: Date: ${date}, Block: ${JSON.stringify(block)}`,
            HttpStatus.BAD_REQUEST
          );
        }
      } else {
        throw new HttpException(`Reserva no existe: ${id}`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Hubo un problema al editar la reserva: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return booking;
  }

  public async acceptBookingTermsAndConditions(
    user: string,
    id: string,
    code: string
  ): Promise<Booking> {
    let booking = undefined;
    try {
      booking = await this.getBookingById(id);
      if (booking && booking.id && !booking.termsConditionsAcceptedCode) {
        if (code && code.length === 6 && code === booking.termsConditionsToAcceptCode) {
          booking.termsConditionsAcceptedCode = code;
          booking.termsConditionsToAcceptedAt = new Date();
          booking = await this.update(user, booking);

          // Publicar evento de aceptación de términos
          const termsAcceptedEvent = new TermsAccepted(new Date(), {
            bookingId: booking.id,
            clientId: booking.clientId,
            commerceId: booking.commerceId,
            acceptedAt: booking.termsConditionsToAcceptedAt,
            acceptedCode: code,
          }, { user });
          publish(termsAcceptedEvent);

          // Crear consentimiento LGPD automáticamente
          if (this.lgpdConsentService && booking.clientId && booking.commerceId) {
            try {
              await this.lgpdConsentService.createOrUpdateConsent(
                user,
                {
                  clientId: booking.clientId,
                  commerceId: booking.commerceId,
                  consentType: ConsentType.TERMS_ACCEPTANCE,
                  purpose: 'Aceptación de términos y condiciones de servicio',
                  legalBasis: 'CONSENT',
                  status: ConsentStatus.GRANTED,
                  notes: `Consentimiento otorgado al aceptar términos y condiciones para booking ${booking.id}`,
                  ipAddress: undefined, // TODO: Obtener IP del request
                  consentMethod: 'WEB',
                }
              );
            } catch (error) {
              // Log error but don't fail the booking update
              this.logger.error(`Error creating LGPD consent for booking ${booking.id}:`, error);
            }
          }

          // Registrar auditoría específica
          if (this.auditLogService) {
            await this.auditLogService.logAction(
              user,
              'UPDATE',
              'booking_terms',
              booking.id,
              {
                entityName: `Aceptación Términos - Booking ${booking.id}`,
                result: 'SUCCESS',
                metadata: {
                  bookingId: booking.id,
                  clientId: booking.clientId,
                  commerceId: booking.commerceId,
                  acceptedCode: code,
                  acceptedAt: booking.termsConditionsToAcceptedAt,
                },
                complianceFlags: {
                  lgpdConsent: true,
                },
              }
            );
          }

          this.logger.log(`Terms accepted for booking ${booking.id} by user ${user}`);
        } else {
          throw new HttpException(
            `Código para aceptar condiciones es incorrecto`,
            HttpStatus.BAD_REQUEST
          );
        }
      } else {
        throw new HttpException(`Reserva no existe: ${id}`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al aceptar condiciones para la reserva: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return booking;
  }
}
