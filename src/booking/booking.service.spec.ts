import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AttentionService } from '../attention/attention.service';
import { BookingBlockNumberUsedService } from '../booking-block-number-used/booking-block-number-used.service';
import { ClientService } from '../client/client.service';
import { CommerceService } from '../commerce/commerce.service';
import { Commerce } from '../commerce/model/commerce.entity';
import { DocumentsService } from '../documents/documents.service';
import { FeatureToggleService } from '../feature-toggle/feature-toggle.service';
import { IncomeService } from '../income/income.service';
import { NotificationService } from '../notification/notification.service';
import { PackageService } from '../package/package.service';
import { QueueService } from '../queue/queue.service';
import { GcpLoggerService } from '../shared/logger/gcp-logger.service';
import { UserService } from '../user/user.service';
import { WaitlistService } from '../waitlist/waitlist.service';

import { BookingService } from './booking.service';

// Mock notifications module - service imports as .js but file is .ts
// Must be before any imports that use it
jest.mock(
  './notifications/notifications.js',
  () => {
    return {
      getBookingMessage: jest.fn(() => 'Test booking message'),
      getBookingConfirmMessage: jest.fn(() => 'Test confirm message'),
      getBookingCancelledMessage: jest.fn(() => 'Test cancelled message'),
      getBookingCommerceConditions: jest.fn(() => ({
        subject: 'Test Subject',
        html: 'Test HTML',
      })),
    };
  },
  { virtual: true }
);

// Mock attention notifications.js as well since booking service imports attention service
jest.mock(
  '../attention/notifications/notifications.js',
  () => {
    return {
      getAttentionMessage: jest.fn(() => 'Test attention message'),
      getAttentionConfirmMessage: jest.fn(() => 'Test confirm message'),
    };
  },
  { virtual: true }
);

import { BookingDefaultBuilder } from './builders/booking-default';
import { BookingChannel } from './model/booking-channel.enum';
import { BookingStatus } from './model/booking-status.enum';
import { Booking } from './model/booking.entity';

import { Queue } from '../queue/model/queue.entity';
import { QueueType } from '../queue/model/queue-type.enum';
import { User } from '../user/model/user.entity';

import { getRepository } from 'fireorm';

// Mock FireORM repository
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  whereEqualTo: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereLessThan: jest.fn().mockReturnThis(),
  whereGreaterOrEqualThan: jest.fn().mockReturnThis(),
  whereLessOrEqualThan: jest.fn().mockReturnThis(),
  whereNotEqualTo: jest.fn().mockReturnThis(),
  orderByAscending: jest.fn().mockReturnThis(),
  orderByDescending: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  find: jest.fn(),
};

describe('BookingService', () => {
  let service: BookingService;
  let queueService: QueueService;
  let commerceService: CommerceService;
  let notificationService: NotificationService;
  let bookingDefaultBuilder: BookingDefaultBuilder;

  const mockQueue = {
    id: 'queue-1',
    name: 'Test Queue',
    commerceId: 'commerce-1',
    limit: 10,
    type: 'standard' as QueueType,
    serviceInfo: {
      blockLimit: 1,
      blocks: [{ number: 1, hourFrom: '09:00', hourTo: '10:00' }],
    },
  } as Queue;

  const mockCommerce: Commerce = {
    id: 'commerce-1',
    name: 'Test Commerce',
    logo: 'logo.png',
    localeInfo: {
      language: 'es',
      timezone: 'America/Santiago',
    },
    contactInfo: {
      whatsapp: '+56912345678',
    },
    features: [],
  } as Commerce;

  const mockUser: User = {
    id: 'user-1',
    name: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+56912345678',
    acceptTermsAndConditions: true,
    notificationOn: true,
    notificationEmailOn: true,
  } as User;

  const mockBooking: Booking = {
    id: 'booking-1',
    number: 1,
    date: '2024-01-15',
    queueId: 'queue-1',
    commerceId: 'commerce-1',
    userId: 'user-1',
    status: BookingStatus.PENDING,
    channel: BookingChannel.QR,
    user: mockUser,
    block: {
      number: 1,
      hourFrom: '09:00',
      hourTo: '10:00',
    },
    createdAt: new Date(),
  } as Booking;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BookingService,
          useFactory: (
            queueService: QueueService,
            notificationService: NotificationService,
            featureToggleService: FeatureToggleService,
            commerceService: CommerceService,
            bookingDefaultBuilder: BookingDefaultBuilder,
            attentionService: AttentionService,
            waitlistService: WaitlistService,
            clientService: ClientService,
            incomeService: IncomeService,
            packageService: PackageService,
            userService: UserService,
            documentsService: DocumentsService,
            bookingBlockNumbersUsedService: BookingBlockNumberUsedService,
            logger: GcpLoggerService
          ) => {
            const service = new BookingService(
              mockRepository as any,
              queueService,
              notificationService,
              featureToggleService,
              commerceService,
              bookingDefaultBuilder,
              attentionService,
              waitlistService,
              clientService,
              incomeService,
              packageService,
              userService,
              documentsService,
              bookingBlockNumbersUsedService,
              logger
            );
            return service;
          },
          inject: [
            QueueService,
            NotificationService,
            FeatureToggleService,
            CommerceService,
            BookingDefaultBuilder,
            AttentionService,
            WaitlistService,
            ClientService,
            IncomeService,
            PackageService,
            UserService,
            DocumentsService,
            BookingBlockNumberUsedService,
            GcpLoggerService,
          ],
        },
        {
          provide: QueueService,
          useValue: {
            getQueueById: jest.fn(),
          },
        },
        {
          provide: CommerceService,
          useValue: {
            getCommerceById: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            createBookingEmailNotification: jest.fn(),
            createBookingWhatsappNotification: jest.fn(),
          },
        },
        {
          provide: FeatureToggleService,
          useValue: {
            getFeatureToggleByCommerceAndType: jest.fn(),
          },
        },
        {
          provide: AttentionService,
          useValue: {
            createAttention: jest.fn(),
          },
        },
        {
          provide: WaitlistService,
          useValue: {
            getWaitlistById: jest.fn(),
            update: jest.fn(),
            notifyWaitListFormCancelledBooking: jest.fn(),
          },
        },
        {
          provide: ClientService,
          useValue: {
            getClientById: jest.fn(),
            saveClient: jest.fn(),
          },
        },
        {
          provide: IncomeService,
          useValue: {
            createIncome: jest.fn(),
            createIncomes: jest.fn(),
            payPendingIncome: jest.fn(),
          },
        },
        {
          provide: PackageService,
          useValue: {
            getPackageByCommerceIdAndClientId: jest.fn(),
            createPackage: jest.fn(),
            addProcedureToPackage: jest.fn(),
            removeProcedureToPackage: jest.fn(),
            payPackage: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
          },
        },
        {
          provide: DocumentsService,
          useValue: {
            getDocument: jest.fn(),
          },
        },
        {
          provide: BookingBlockNumberUsedService,
          useValue: {
            getTakenBookingsBlocksByDate: jest.fn().mockResolvedValue([]),
            deleteTakenBookingsBlocksByDate: jest.fn().mockResolvedValue([]),
            editQueueTakenBookingsBlocksByDate: jest.fn().mockResolvedValue([]),
            editHourAndDateTakenBookingsBlocksByDate: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: BookingDefaultBuilder,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: GcpLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            logWithRequest: jest.fn(),
            logError: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    queueService = module.get<QueueService>(QueueService);
    commerceService = module.get<CommerceService>(CommerceService);
    notificationService = module.get<NotificationService>(NotificationService);
    bookingDefaultBuilder = module.get<BookingDefaultBuilder>(BookingDefaultBuilder);

    // Set repository mock on service instance
    (service as any).bookingRepository = mockRepository;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getBookingById', () => {
    it('should return a booking when found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockBooking);
      // Set repository on service instance
      (service as any).bookingRepository = mockRepository;

      // Act
      const result = await service.getBookingById('booking-1');

      // Assert
      expect(result).toEqual(mockBooking);
      expect(mockRepository.findById).toHaveBeenCalledWith('booking-1');
    });

    it('should return undefined when booking not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);
      (service as any).bookingRepository = mockRepository;

      // Act
      const result = await service.getBookingById('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('createBooking', () => {
    const createBookingParams = {
      queueId: 'queue-1',
      channel: BookingChannel.QR,
      date: '2024-01-15',
      user: mockUser,
      block: {
        number: 1,
        hourFrom: '09:00',
        hourTo: '10:00',
      },
      status: BookingStatus.PENDING,
      servicesId: [],
      servicesDetails: [],
    };

    beforeEach(() => {
      jest.spyOn(queueService, 'getQueueById').mockResolvedValue(mockQueue);
      jest.spyOn(commerceService, 'getCommerceById').mockResolvedValue(mockCommerce);
      // Mock repository methods that the service uses - chain them properly
      mockRepository.whereEqualTo.mockReturnThis();
      mockRepository.whereIn.mockReturnThis();
      mockRepository.whereLessThan.mockReturnThis();
      mockRepository.whereLessOrEqualThan.mockReturnThis();
      mockRepository.whereGreaterOrEqualThan.mockReturnThis();
      mockRepository.find.mockResolvedValue([]);
      // Ensure repository is set on service
      (service as any).bookingRepository = mockRepository;
      jest.spyOn(bookingDefaultBuilder, 'create').mockResolvedValue(mockBooking);
      jest.spyOn(service, 'bookingEmail').mockResolvedValue([mockBooking]);
      jest.spyOn(service, 'bookingWhatsapp').mockResolvedValue([mockBooking]);
      jest.spyOn(service, 'bookingCommerceConditionsEmail').mockResolvedValue([]);
    });

    it('should create a booking successfully', async () => {
      // Arrange
      jest.spyOn(service, 'getBookingsByQueueAndDate').mockResolvedValue([]);

      // Act
      const result = await service.createBooking(
        createBookingParams.queueId,
        createBookingParams.channel,
        createBookingParams.date,
        createBookingParams.user,
        createBookingParams.block,
        createBookingParams.status,
        createBookingParams.servicesId,
        createBookingParams.servicesDetails
      );

      // Assert
      expect(result).toEqual(mockBooking);
      expect(queueService.getQueueById).toHaveBeenCalledWith('queue-1');
      expect(bookingDefaultBuilder.create).toHaveBeenCalled();
    });

    it('should throw error if user has not accepted terms', async () => {
      // Arrange
      const userWithoutTerms = { ...mockUser, acceptTermsAndConditions: false };

      // Act & Assert
      await expect(
        service.createBooking(
          createBookingParams.queueId,
          createBookingParams.channel,
          createBookingParams.date,
          userWithoutTerms,
          createBookingParams.block,
          createBookingParams.status
        )
      ).rejects.toThrow(HttpException);
    });

    it('should throw error if queue limit is reached', async () => {
      // Arrange
      const existingBookings = Array(10).fill(mockBooking);
      jest.spyOn(service, 'getPendingBookingsByQueueAndDate').mockResolvedValue(existingBookings);

      // Act & Assert
      await expect(
        service.createBooking(
          createBookingParams.queueId,
          createBookingParams.channel,
          createBookingParams.date,
          createBookingParams.user,
          createBookingParams.block,
          createBookingParams.status
        )
      ).rejects.toThrow(HttpException);
    });

    it('should throw error if block is already taken', async () => {
      // Arrange
      jest.spyOn(service, 'validateBookingBlocksToCreate').mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.createBooking(
          createBookingParams.queueId,
          createBookingParams.channel,
          createBookingParams.date,
          createBookingParams.user,
          createBookingParams.block,
          createBookingParams.status
        )
      ).rejects.toThrow(HttpException);
    });
  });

  describe('cancelBooking', () => {
    beforeEach(() => {
      mockRepository.findById.mockResolvedValue(mockBooking);
      mockRepository.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.RESERVE_CANCELLED,
        cancelled: true,
        cancelledAt: new Date(),
      });
    });

    it('should cancel a booking successfully', async () => {
      // Arrange
      jest.spyOn(service, 'update').mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.RESERVE_CANCELLED,
        cancelled: true,
      } as Booking);
      jest.spyOn(service, 'bookingCancelWhatsapp').mockResolvedValue([]);

      // Act
      const result = await service.cancelBooking('user-1', 'booking-1');

      // Assert
      expect(result.status).toBe(BookingStatus.RESERVE_CANCELLED);
      expect(result.cancelled).toBe(true);
    });

    it('should throw error if booking does not exist', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.cancelBooking('user-1', 'non-existent')).rejects.toThrow(HttpException);
    });
  });

  describe('getBookingDetails', () => {
    it('should return booking details with queue and commerce', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(mockBooking);
      jest.spyOn(queueService, 'getQueueById').mockResolvedValue(mockQueue);
      jest.spyOn(commerceService, 'getCommerceById').mockResolvedValue(mockCommerce);
      jest.spyOn(service, 'getBookingsBeforeYouByDate').mockResolvedValue([]);

      // Act
      const result = await service.getBookingDetails('booking-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('booking-1');
      expect(result.queue).toBeDefined();
      expect(result.commerce).toBeDefined();
    });

    it('should throw error if booking not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.getBookingDetails('non-existent')).rejects.toThrow(HttpException);
    });
  });
});
