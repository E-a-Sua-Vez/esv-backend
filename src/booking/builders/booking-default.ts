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
import { User } from 'src/user/user.entity';

@Injectable()
export class BookingDefaultBuilder implements BookingBuilderInterface {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking)
  ){}

  async create(number: number, date: string, queue: Queue, channel?: string, user?: User, block?: Block): Promise<Booking> {
    let booking = new Booking();
    booking.status = BookingStatus.PENDING;
    booking.type = BookingType.STANDARD;
    booking.createdAt = new Date();
    booking.queueId = queue.id;
    booking.date = date;
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