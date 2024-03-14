import { Collection } from 'fireorm';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { User } from 'src/user/model/user.entity';

export class Block {
    number: number;
    hourFrom: string;
    hourTo: string;
}

@Collection('booking')
export class Booking {
    id: string;
    commerceId: string;
    queueId: string;
    number: number;
    date: string;
    dateFormatted: Date;
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
    block?: Block;
    confirmedAt: Date;
    confirmed: boolean;
    confirmationData?: PaymentConfirmation;
    confirmNotified: boolean = false;
    confirmNotifiedEmail: boolean = false;
    confirmNotifiedWhatsapp: boolean = false;
}