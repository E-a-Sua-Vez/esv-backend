import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { AwsClient } from './infrastructure/aws-client';
import { TwilioClient } from './infrastructure/twilio-client';
import { WhatsGwClient } from './infrastructure/whatsgw-client';
import { Notification } from './model/notification.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [FireormModule.forFeature([Notification]), HttpModule],
  providers: [NotificationService, TwilioClient, WhatsGwClient, AwsClient],
  exports: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
