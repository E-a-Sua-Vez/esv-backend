import { User } from 'src/user/model/user.entity';
import { Block } from '../model/booking.entity';

export class BookingAvailabilityDto {
  id: string;
  commerceId: string;
  queueId: string;
  number: number;
  date: string;
  status: string;
  block: Block;
  user: User;
}