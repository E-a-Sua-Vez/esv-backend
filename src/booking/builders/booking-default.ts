import { Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { BookingBuilderInterface } from '../../shared/interfaces/booking-builder';
import { BookingStatus } from '../model/booking-status.enum';
import { BookingType } from '../model/booking-type.enum';
import { Block, Booking } from '../model/booking.entity';
import { Queue } from '../../queue/model/queue.entity';
import BookingCreated from '../events/BookingCreated';
import { publish } from 'ett-events-lib';
import { User } from 'src/user/model/user.entity';
import { Commerce } from 'src/commerce/model/commerce.entity';
import { FeatureToggle } from 'src/feature-toggle/model/feature-toggle.entity';
import { ServiceService } from 'src/service/service.service';
import { PackageService } from '../../package/package.service';
import { PackageType } from 'src/package/model/package-type.enum';
import { PackageStatus } from 'src/package/model/package-status.enum';

@Injectable()
export class BookingDefaultBuilder implements BookingBuilderInterface {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking),
    private serviceService: ServiceService,
    private packageService: PackageService
  ){}

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
    clientId?: string
  ): Promise<Booking> {
    let booking = new Booking();
    booking.status = BookingStatus.CONFIRMED;
    if (status) {
      booking.status = status
    } else {
      if (this.featureToggleIsActive(commerce.features, 'booking-confirm')){
        booking.status = BookingStatus.PENDING;
      }
    }
    booking.type = BookingType.STANDARD;
    booking.createdAt = new Date();
    booking.queueId = queue.id;
    booking.date = date;
    const [year,month,day] = date.split('-');
    booking.dateFormatted = new Date(+year, +month - 1, +day);
    booking.commerceId = queue.commerceId;
    booking.number = number
    booking.channel = channel;
    if (clientId !== undefined) {
      booking.clientId = clientId;
    }
    if (user !== undefined) {
      booking.user = user;
    }
    if (block !== undefined) {
      booking.block = block;
    }
    if (servicesId !== undefined) {
      booking.servicesId = servicesId;
    }
    if (servicesDetails !== undefined) {
      booking.servicesDetails = servicesDetails;
    }
    if (this.featureToggleIsActive(commerce.features, 'email-bookings-terms-conditions')){
      booking.termsConditionsToAcceptCode = Math.random().toString(36).slice(2, 8);
    }
    let bookingCreated = await this.bookingRepository.create(booking);
    if (bookingCreated.servicesId && bookingCreated.servicesId.length === 1) {
      const service = await this.serviceService.getServiceById(bookingCreated.servicesId[0]);
      if (service && service.id && service.serviceInfo && service.serviceInfo.procedures && service.serviceInfo.procedures > 1) {
        if (bookingCreated.clientId) {
          const packs = await this.packageService.getPackageByCommerceIdAndClientServices(bookingCreated.commerceId, bookingCreated.clientId, bookingCreated.servicesId[0]);
          if (packs && packs.length === 0) {
            const packageName = service.tag.toLocaleUpperCase();
            const packCreated = await this.packageService.createPackage('ett', bookingCreated.commerceId, bookingCreated.clientId, bookingCreated.id, undefined,
            service.serviceInfo.procedures, packageName, bookingCreated.servicesId, [bookingCreated.id], [], PackageType.STANDARD, PackageStatus.REQUESTED);
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