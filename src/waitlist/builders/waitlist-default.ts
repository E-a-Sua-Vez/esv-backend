import { Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { WaitlistBuilderInterface } from '../../shared/interfaces/waitlist-builder';
import { WaitlistStatus } from '../model/waitlist-status.enum';
import { WaitlistType } from '../model/waitlist-type.enum';
import { Block, Waitlist } from '../model/waitlist.entity';
import { Queue } from '../../queue/model/queue.entity';
import WaitlistCreated from '../events/WaitlistCreated';
import { publish } from 'ett-events-lib';
import { User } from 'src/user/model/user.entity';

@Injectable()
export class WaitlistDefaultBuilder implements WaitlistBuilderInterface {
  constructor(
    @InjectRepository(Waitlist)
    private bookingRepository = getRepository(Waitlist)
  ){}

  async create(date: string, queue: Queue, channel?: string, user?: User): Promise<Waitlist> {
    let waitlist = new Waitlist();
    waitlist.status = WaitlistStatus.PENDING;
    waitlist.type = WaitlistType.STANDARD;
    waitlist.createdAt = new Date();
    waitlist.queueId = queue.id;
    waitlist.date = date;
    waitlist.commerceId = queue.commerceId;
    waitlist.channel = channel;
    if (user !== undefined) {
      waitlist.user = user;
    }
    let bookingCreated = await this.bookingRepository.create(waitlist);
    const bookingCreatedEvent = new WaitlistCreated(new Date(), bookingCreated);
    publish(bookingCreatedEvent);
    return bookingCreated;
  }
}