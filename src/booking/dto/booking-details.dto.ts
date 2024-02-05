import { User } from '../../user/user.entity';
import { Commerce } from '../../commerce/model/commerce.entity';
import { Queue } from '../../queue/model/queue.entity';
import { Block } from '../model/booking.entity';

export class BookingDetailsDto {
  id: string;
    commerceId: string;
    queueId: string;
    number: number;
    date: string;
    createdAt: Date;
    type: string;
    channel: string;
    status: string;
    userId: string;
    comment: string;
    processedAt: Date;
    processed: boolean;
    cancelledAt: Date;
    cancelled: boolean;
    attentionId: string;
    beforeYou: number;
    user: User;
    commerce: Commerce;
    queue: Queue;
    block: Block;
}
