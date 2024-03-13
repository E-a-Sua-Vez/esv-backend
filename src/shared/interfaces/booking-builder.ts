import { Booking } from 'src/booking/model/booking.entity';
import { Commerce } from 'src/commerce/model/commerce.entity';
import { Queue } from '../../queue/model/queue.entity';

export interface BookingBuilderInterface {
  create(number: number, date: string, commerce: Commerce, queue: Queue, channel?: string): Promise<Booking>;
}
