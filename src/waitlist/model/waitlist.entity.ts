import { Collection } from 'fireorm';
import { User } from 'src/user/model/user.entity';

export class Block {
    number: number;
    hourFrom: string;
    hourTo: string;
}

@Collection('waitlist')
export class Waitlist {
    id: string;
    commerceId: string;
    queueId: string;
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
    user: User;
    clientId: string;
}