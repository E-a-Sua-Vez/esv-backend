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
  waitlistId: string;
  commerceId: string;
  queueId: string;
  comment = 'OK';
  received = false;
  providerData?: NotificationThirdPartyDto;
  title?: string;
  message?: string;
  data?: any;
}
