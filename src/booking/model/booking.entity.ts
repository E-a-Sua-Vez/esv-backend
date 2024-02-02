import { Collection } from 'fireorm';
import { User } from 'src/user/user.entity';

@Collection('booking')
export class Booking {
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
    user: User;
}