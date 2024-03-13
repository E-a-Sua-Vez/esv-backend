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


@Injectable()
export class BookingDefaultBuilder implements BookingBuilderInterface {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking)
  ){}

  featureToggleIsActive(featureToggle: FeatureToggle[], name: string): boolean {
    const feature = featureToggle.find(elem => elem.name === name);
    if (feature) {
      return feature.active;
    }
    return false;
  }

  async create(number: number, date: string, commerce: Commerce, queue: Queue, channel?: string, user?: User, block?: Block, status?: BookingStatus): Promise<Booking> {
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
    if (user !== undefined) {
      booking.user = user;
    }
    if (block !== undefined) {
      booking.block = block;
    }
    let bookingCreated = await this.bookingRepository.create(booking);
    const bookingCreatedEvent = new BookingCreated(new Date(), bookingCreated);
    publish(bookingCreatedEvent);
    return bookingCreated;
  }
}