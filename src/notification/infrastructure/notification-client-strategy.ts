import { NotificationChannel } from '../model/notification-channel.enum';
import { NotificationProvider } from '../model/notification-provider';

import { AwsClient } from './aws-client';
import { TwilioClient } from './twilio-client';
import { WhatsGwClient } from './whatsgw-client';

export function clientStrategy(channel: NotificationChannel) {
  let provider;
  if (channel === NotificationChannel.WHATSAPP) {
    provider = process.env.WHATSAPP_NOTIFICATION_PROVIDER || 'N/I';
    if (provider === NotificationProvider.WHATSGW) {
      return WhatsGwClient;
    }
    if (provider === NotificationProvider.TWILIO) {
      return TwilioClient;
    }
    return TwilioClient;
  }
  if (channel === NotificationChannel.EMAIL) {
    provider = process.env.EMAIL_NOTIFICATION_PROVIDER || 'N/I';
    if (provider === NotificationProvider.AWS) {
      return AwsClient;
    }
    return AwsClient;
  }
  if (channel === NotificationChannel.SMS) {
    // SMS uses Twilio by default
    return TwilioClient;
  }
}
