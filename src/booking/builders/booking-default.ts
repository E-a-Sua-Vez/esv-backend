import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Commerce } from 'src/commerce/model/commerce.entity';
import { FeatureToggle } from 'src/feature-toggle/model/feature-toggle.entity';
import { PackageStatus } from 'src/package/model/package-status.enum';
import { PackageType } from 'src/package/model/package-type.enum';
import { ServiceService } from 'src/service/service.service';
import { User } from 'src/user/model/user.entity';

import { PackageService } from '../../package/package.service';
import { Queue } from '../../queue/model/queue.entity';
import { BookingBuilderInterface } from '../../shared/interfaces/booking-builder';
import { BookingStatus } from '../model/booking-status.enum';
import { BookingType } from '../model/booking-type.enum';
import { Block, Booking } from '../model/booking.entity';

@Injectable()
export class BookingDefaultBuilder implements BookingBuilderInterface {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking),
    private serviceService: ServiceService,
    @Inject(forwardRef(() => PackageService))
    private packageService: PackageService
  ) {}

  featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  async create(
    number: number,
    date: string,
    commerce: Commerce,
    queue: Queue,
    channel?: string,
    user?: User,
    block?: Block,
    status?: BookingStatus,
    servicesId?: string[],
    servicesDetails?: object[],
    clientId?: string,
    type?: string,
    telemedicineConfig?: {
      type: 'VIDEO' | 'CHAT' | 'BOTH';
      scheduledAt: string;
      recordingEnabled?: boolean;
      notes?: string;
    }
  ): Promise<Booking> {
    const booking = new Booking();
    booking.status = BookingStatus.CONFIRMED;
    if (status) {
      booking.status = status;
    } else {
      if (this.featureToggleIsActive(commerce.features, 'booking-confirm')) {
        booking.status = BookingStatus.PENDING;
      }
    }
    booking.type = type === 'TELEMEDICINE' ? BookingType.TELEMEDICINE : BookingType.STANDARD;
    if (telemedicineConfig) {
      // Convert type to lowercase to match entity format
      const configType = telemedicineConfig.type?.toLowerCase() as 'video' | 'chat' | 'both';
      // Use commerce configuration for recordingEnabled
      const recordingEnabled = commerce.telemedicineRecordingEnabled || false;

      // Validate scheduledAt is in the future
      const scheduledAt = telemedicineConfig.scheduledAt
        ? new Date(telemedicineConfig.scheduledAt)
        : new Date();
      const now = new Date();
      if (scheduledAt <= now) {
        throw new Error(`La fecha de telemedicina debe ser en el futuro. Fecha proporcionada: ${scheduledAt.toISOString()}`);
      }

      booking.telemedicineConfig = {
        type: configType || 'video',
        scheduledAt: scheduledAt,
        recordingEnabled: recordingEnabled, // Usar configuración del comercio
        notes: telemedicineConfig.notes || '',
      };
    }
    booking.createdAt = new Date();
    booking.queueId = queue.id;
    booking.date = date;
    const [year, month, day] = date.split('-');
    booking.dateFormatted = new Date(+year, +month - 1, +day);
    booking.commerceId = queue.commerceId;
    booking.number = number;
    booking.channel = channel;
    if (clientId !== undefined) {
      booking.clientId = clientId;
    }
    if (user !== undefined) {
      booking.user = user;
    }
    if (block !== undefined && block !== null) {
      // Simply assign the block as-is, Firestore will handle serialization
      booking.block = block;
    }
    if (servicesId !== undefined) {
      booking.servicesId = servicesId;
    }
    // Debug: Log incoming servicesDetails
    if (servicesDetails !== undefined) {
      console.log('[BookingDefaultBuilder] Incoming servicesDetails:', JSON.stringify(servicesDetails, null, 2));
    }

    // Handle servicesDetails - clean to avoid nested arrays
    if (servicesDetails !== undefined) {
      if (Array.isArray(servicesDetails) && servicesDetails.length > 0) {
        // Clean each service detail to remove any nested arrays
        booking.servicesDetails = servicesDetails.map((detail: any) => {
          if (!detail || typeof detail !== 'object') {
            return detail;
          }
          const cleanDetail: any = {};
          Object.keys(detail).forEach(key => {
            const value = detail[key];
            // Only include primitives or arrays of primitives (not arrays of objects)
            if (Array.isArray(value)) {
              // Only include if it's an array of primitives
              if (value.length === 0 || (typeof value[0] !== 'object' && value[0] !== null)) {
                cleanDetail[key] = value;
              }
              // Skip arrays of objects (nested arrays)
            } else if (value !== undefined && value !== null) {
              cleanDetail[key] = value;
            }
          });
          return cleanDetail;
        });
        console.log('[BookingDefaultBuilder] ServicesDetails assigned to booking:', JSON.stringify(booking.servicesDetails, null, 2));
      } else {
        // If explicitly provided but empty, set to empty array
        booking.servicesDetails = [];
      }
    }
    // If servicesDetails is undefined, don't set it (let it be undefined)
    if (this.featureToggleIsActive(commerce.features, 'email-bookings-terms-conditions')) {
      booking.termsConditionsToAcceptCode = Math.random().toString(36).slice(2, 8);
    }
    // Final validation: ensure no nested arrays before saving
    const validateNoNestedArrays = (obj: any, path = ''): void => {
      if (obj === null || obj === undefined) return;
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (Array.isArray(item)) {
            throw new Error(`Nested arrays detected at ${path}[${index}]`);
          }
          if (item && typeof item === 'object') {
            validateNoNestedArrays(item, `${path}[${index}]`);
          }
        });
      } else if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          if (Array.isArray(value)) {
            // Check if array contains arrays
            if (value.some(item => Array.isArray(item))) {
              throw new Error(`Nested arrays detected at ${path}.${key}`);
            }
            // Check if array contains objects with arrays
            value.forEach((item, index) => {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                validateNoNestedArrays(item, `${path}.${key}[${index}]`);
              }
            });
          } else if (value && typeof value === 'object') {
            validateNoNestedArrays(value, `${path}.${key}`);
          }
        });
      }
    };

    // Validate critical fields
    if (booking.block) {
      validateNoNestedArrays(booking.block, 'block');
    }
    if (booking.servicesDetails) {
      validateNoNestedArrays(booking.servicesDetails, 'servicesDetails');
    }

    // Debug: Log booking before creating
    console.log('[BookingDefaultBuilder] Booking before create:');
    console.log('  - block:', JSON.stringify(booking.block, null, 2));
    console.log('  - servicesDetails:', JSON.stringify(booking.servicesDetails, null, 2));
    const bookingCreated = await this.bookingRepository.create(booking);
    // Debug: Log booking after creating
    console.log('[BookingDefaultBuilder] Booking after create:');
    console.log('  - block:', JSON.stringify(bookingCreated.block, null, 2));
    console.log('  - servicesDetails:', JSON.stringify(bookingCreated.servicesDetails, null, 2));
    if (bookingCreated.servicesId && bookingCreated.servicesId.length === 1) {
      const service = await this.serviceService.getServiceById(bookingCreated.servicesId[0]);

      // Determine procedures amount: from servicesDetails first, then service.serviceInfo.procedures, then service.serviceInfo.proceduresList
      let proceduresAmount = 0;
      console.log('[BookingDefaultBuilder] Determining procedures amount:', {
        servicesDetails: servicesDetails,
        servicesDetailsLength: servicesDetails?.length,
        firstServiceDetails: servicesDetails?.[0],
        proceduresInDetails: servicesDetails?.[0]?.['procedures'],
        serviceProcedures: service?.serviceInfo?.procedures,
        serviceProceduresList: service?.serviceInfo?.proceduresList
      });

      if (servicesDetails && servicesDetails.length > 0 && servicesDetails[0]['procedures']) {
        proceduresAmount = parseInt(servicesDetails[0]['procedures'], 10) || servicesDetails[0]['procedures'];
        console.log('[BookingDefaultBuilder] Using procedures from servicesDetails:', proceduresAmount);
      } else if (service && service.serviceInfo && service.serviceInfo.procedures) {
        proceduresAmount = service.serviceInfo.procedures;
        console.log('[BookingDefaultBuilder] Using procedures from service.serviceInfo:', proceduresAmount);
      } else if (service && service.serviceInfo && service.serviceInfo.proceduresList) {
        // Use first value from proceduresList as fallback
        const proceduresList = service.serviceInfo.proceduresList.trim().split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p > 0);
        if (proceduresList.length > 0) {
          proceduresAmount = proceduresList[0];
          console.log('[BookingDefaultBuilder] Using first value from proceduresList:', proceduresAmount);
        }
      }

      console.log('[BookingDefaultBuilder] Final proceduresAmount:', proceduresAmount);

      if (proceduresAmount > 1) {
        if (bookingCreated.clientId) {
          const packs = await this.packageService.getPackageByCommerceIdAndClientServices(
            bookingCreated.commerceId,
            bookingCreated.clientId,
            bookingCreated.servicesId[0]
          );
          if (packs && packs.length > 0) {
            // Associate booking to existing active package with sessions remaining
            const activePackage = packs.find(pkg => {
              const isActive = [PackageStatus.ACTIVE, PackageStatus.CONFIRMED, PackageStatus.REQUESTED].includes(pkg.status);
              const hasPendingSessions = (pkg.proceduresLeft || 0) > 0;
              return isActive && hasPendingSessions;
            });
            if (activePackage) {
              booking.packageId = activePackage.id;
              await this.bookingRepository.update(booking);
              // Add booking to package
              await this.packageService.addProcedureToPackage(
                'ett',
                activePackage.id,
                [bookingCreated.id],
                []
              );
            } else {
              // No active package found, create new one
              const packageName = service.tag.toLocaleUpperCase();
              const packCreated = await this.packageService.createPackage(
                'ett',
                bookingCreated.commerceId,
                bookingCreated.clientId,
                bookingCreated.id,
                undefined,
                proceduresAmount,
                packageName,
                bookingCreated.servicesId,
                [bookingCreated.id],
                [],
                PackageType.STANDARD,
                PackageStatus.REQUESTED
              );
              booking.packageId = packCreated.id;
              await this.bookingRepository.update(booking);
            }
          } else {
            // No packages exist, create new one
            const packageName = service.tag.toLocaleUpperCase();
            const packCreated = await this.packageService.createPackage(
              'ett',
              bookingCreated.commerceId,
              bookingCreated.clientId,
              bookingCreated.id,
              undefined,
              proceduresAmount,
              packageName,
              bookingCreated.servicesId,
              [bookingCreated.id],
              [],
              PackageType.STANDARD,
              PackageStatus.REQUESTED
            );
            booking.packageId = packCreated.id;
            await this.bookingRepository.update(booking);
          }
        }
      }
    }

    // Note: Professional auto-assignment is handled in BookingService after creation
    // Note: BookingCreated event is published in BookingService.createBooking()
    // to have access to user metadata
    return bookingCreated;
  }
}
