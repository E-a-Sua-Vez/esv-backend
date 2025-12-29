import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { Attention } from '../attention/model/attention.entity';
import { AwsClient } from './infrastructure/aws-client';
import { TwilioClient } from './infrastructure/twilio-client';
import { WhatsGwClient } from './infrastructure/whatsgw-client';
import { Notification } from './model/notification.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    FireormModule.forFeature([Notification, Attention]),
    HttpModule,
  ],
  providers: [NotificationService, TwilioClient, WhatsGwClient, AwsClient],
  exports: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
