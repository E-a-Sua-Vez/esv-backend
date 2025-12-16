import { Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
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
import BookingCreated from '../events/BookingCreated';
import { BookingStatus } from '../model/booking-status.enum';
import { BookingType } from '../model/booking-type.enum';
import { Block, Booking } from '../model/booking.entity';

@Injectable()
export class BookingDefaultBuilder implements BookingBuilderInterface {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking),
    private serviceService: ServiceService,
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
      booking.telemedicineConfig = {
        type: configType || 'video',
        scheduledAt: telemedicineConfig.scheduledAt
          ? new Date(telemedicineConfig.scheduledAt)
          : new Date(),
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
    if (block !== undefined) {
      // Ensure block is properly serialized as a plain object for Firestore
      // Firestore doesn't allow nested arrays, so we need to flatten the structure
      // Create a plain object to avoid any Firestore serialization issues
      const plainBlock: any = {};

      // Copy properties, ensuring all are plain values
      if (block.number !== undefined) {
        plainBlock.number = block.number;
      }
      if (block.hourFrom !== undefined) {
        plainBlock.hourFrom = block.hourFrom;
      }
      if (block.hourTo !== undefined) {
        plainBlock.hourTo = block.hourTo;
      }

      // Handle blocks array - Firestore allows arrays of objects, but NOT nested arrays
      // If we have a blocks array, we'll use that and NOT include blockNumbers to avoid nested arrays
      if (block.blocks !== undefined && Array.isArray(block.blocks) && block.blocks.length > 0) {
        // Map to plain objects, removing any nested arrays (blocks or blockNumbers) from child blocks
        plainBlock.blocks = block.blocks.map(b => {
          const plainBlockItem: any = {};
          if (b.number !== undefined) {
            plainBlockItem.number = b.number;
          }
          if (b.hourFrom !== undefined) {
            plainBlockItem.hourFrom = b.hourFrom;
          }
          if (b.hourTo !== undefined) {
            plainBlockItem.hourTo = b.hourTo;
          }
          // Do NOT include nested blocks or blockNumbers arrays - Firestore doesn't allow nested arrays
          return plainBlockItem;
        });

        // If there's no root number but there are blocks, use the first block's number
        if (plainBlock.number === undefined && plainBlock.blocks.length > 0) {
          plainBlock.number = plainBlock.blocks[0].number;
        }

        // If there's no root hourFrom/hourTo but there are blocks, use the first block's times
        if (plainBlock.hourFrom === undefined && plainBlock.blocks.length > 0) {
          plainBlock.hourFrom = plainBlock.blocks[0].hourFrom;
        }
        if (plainBlock.hourTo === undefined && plainBlock.blocks.length > 0) {
          plainBlock.hourTo = plainBlock.blocks[plainBlock.blocks.length - 1].hourTo;
        }

        // Do NOT include blockNumbers when we have blocks array to avoid "nested arrays" error
        // The blockNumbers can be derived from the blocks array if needed
      } else if (block.blockNumbers !== undefined && Array.isArray(block.blockNumbers)) {
        // Only include blockNumbers if we don't have a blocks array
        plainBlock.blockNumbers = [...block.blockNumbers];
      }

      booking.block = plainBlock as Block;
    }
    if (servicesId !== undefined) {
      booking.servicesId = servicesId;
    }
    if (servicesDetails !== undefined) {
      // Ensure servicesDetails doesn't contain nested arrays
      // Firestore doesn't allow nested arrays
      booking.servicesDetails = JSON.parse(JSON.stringify(servicesDetails)).map((detail: any) => {
        const plainDetail: any = {};
        Object.keys(detail).forEach(key => {
          const value = detail[key];
          // Remove any nested arrays - convert them to plain objects or remove them
          if (Array.isArray(value)) {
            // Only include arrays of primitives, not nested arrays
            if (value.length > 0 && typeof value[0] !== 'object') {
              plainDetail[key] = value;
            }
            // Skip nested arrays
          } else {
            plainDetail[key] = value;
          }
        });
        return plainDetail;
      });
    }
    if (this.featureToggleIsActive(commerce.features, 'email-bookings-terms-conditions')) {
      booking.termsConditionsToAcceptCode = Math.random().toString(36).slice(2, 8);
    }
    const bookingCreated = await this.bookingRepository.create(booking);
    if (bookingCreated.servicesId && bookingCreated.servicesId.length === 1) {
      const service = await this.serviceService.getServiceById(bookingCreated.servicesId[0]);
      if (
        service &&
        service.id &&
        service.serviceInfo &&
        service.serviceInfo.procedures &&
        service.serviceInfo.procedures > 1
      ) {
        if (bookingCreated.clientId) {
          const packs = await this.packageService.getPackageByCommerceIdAndClientServices(
            bookingCreated.commerceId,
            bookingCreated.clientId,
            bookingCreated.servicesId[0]
          );
          if (packs && packs.length === 0) {
            const packageName = service.tag.toLocaleUpperCase();
            const packCreated = await this.packageService.createPackage(
              'ett',
              bookingCreated.commerceId,
              bookingCreated.clientId,
              bookingCreated.id,
              undefined,
              service.serviceInfo.procedures,
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
    const bookingCreatedEvent = new BookingCreated(new Date(), bookingCreated);
    publish(bookingCreatedEvent);
    return bookingCreated;
  }
}
