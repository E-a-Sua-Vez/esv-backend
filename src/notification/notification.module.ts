import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { NotificationController } from './notification.controller';
import { Notification } from './model/notification.entity';
import { NotificationService } from './notification.service';
import { TwilioClient } from './infrastructure/twilio-client';
import { WhatsGwClient } from './infrastructure/whatsgw-client';
import { HttpModule } from '@nestjs/axios';
import { AwsClient } from './infrastructure/aws-client';

@Module({
  imports: [
    FireormModule.forFeature([Notification]),
    HttpModule
  ],
  providers: [
    NotificationService,
    TwilioClient,
    WhatsGwClient,
    AwsClient
  ],
  exports: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}