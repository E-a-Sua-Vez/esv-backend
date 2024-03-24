import { Collection } from 'fireorm';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { User } from 'src/user/model/user.entity';
import { AttentionStatus } from './attention-status.enum';

export class Block {
    number: number;
    hourFrom: string;
    hourTo: string;
    blocks?: Block[];
    blockNumbers?: number[];
}

@Collection('attention')
export class Attention {
    id: string;
    commerceId: string;
    collaboratorId: string;
    serviceId: string;
    servicesId: string[];
    createdAt: Date;
    endAt: Date;
    number: number;
    queueId: string;
    status: AttentionStatus;
    userId: string;
    moduleId: string;
    comment: string;
    surveyId: string;
    reactivatedAt: Date;
    reactivated: boolean;
    duration: number;
    type: string;
    assistingCollaboratorId: string;
    notificationOn: boolean = false;
    notificationEmailOn: boolean = false;
    channel: string;
    user: User;
    ratedAt: Date;
    rateDuration: number;
    cancelled: boolean;
    cancelledAt: Date;
    transfered: boolean;
    transferedAt: Date;
    transferedOrigin: string;
    paidAt: Date;
    paid: boolean;
    paymentConfirmationData?: PaymentConfirmation;
    bookingId: string;
    block?: Block;
    servicesDetails: object[]
}