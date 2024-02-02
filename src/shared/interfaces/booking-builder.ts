import { Booking } from 'src/booking/model/booking.entity';
import { Queue } from '../../queue/queue.entity';

export interface BookingBuilderInterface {
  create(number: number, date: string, queueId: Queue, channel?: string): Promise<Booking>;
}
