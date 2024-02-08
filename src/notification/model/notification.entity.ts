import { Collection } from 'fireorm';
import { NotificationThirdPartyDto } from './notification-third-party.dto';

@Collection('notification')
export class Notification {
    id: string;
    createdAt: Date;
    channel: string;
    type: string;
    receiver: string;
    twilioId: string;
    providerId: string;
    provider: string;
    attentionId: string;
    bookingId: string;
    commerceId: string;
    queueId: string;
    comment: string = 'OK';
    received: boolean = false;
    providerData?: NotificationThirdPartyDto
}