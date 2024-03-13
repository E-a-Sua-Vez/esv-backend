import { Collection } from 'fireorm';
import { User } from 'src/user/model/user.entity';
import { PaymentMethod } from './payment-method.enum';
import { PaymentType } from './payment-type.enum';

export class Block {
    number: number;
    hourFrom: string;
    hourTo: string;
}

export class BookingConfirmation {
    bankEntity: string;
    transactionId: string;
    paymentType: PaymentType;
    paymentMethod: PaymentMethod;
    installments: number;
    paid: boolean;
    totalAmount: number;
    paymentAmount: number;
    paymentPercentage: number;
    paymentDate: Date;
    paymentCommission: number;
    paymentComment: string;
    promotionalCode: string;
    user: string;
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
    confirmationData?: BookingConfirmation;
    confirmNotified: boolean = false;
    confirmNotifiedEmail: boolean = false;
    confirmNotifiedWhatsapp: boolean = false;
}