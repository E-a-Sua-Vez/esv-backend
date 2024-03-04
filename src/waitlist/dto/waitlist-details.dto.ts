import { User } from '../../user/model/user.entity';
import { Commerce } from '../../commerce/model/commerce.entity';
import { Queue } from '../../queue/model/queue.entity';
import { Block } from '../model/waitlist.entity';

export class WaitlistDetailsDto {
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
    bookingId: string;
    beforeYou: number;
    user: User;
    commerce: Commerce;
    queue: Queue;
    block: Block;
}
