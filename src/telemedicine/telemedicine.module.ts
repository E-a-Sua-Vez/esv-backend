import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { AttentionModule } from '../attention/attention.module';
import { ClientModule } from '../client/client.module';
import { ClientPortalModule } from '../client-portal/client-portal.module';
import { CommerceModule } from '../commerce/commerce.module';
import { NotificationModule } from '../notification/notification.module';
import { PatientHistoryModule } from '../patient-history/patient-history.module';

import { WebSocketAccessKeyGuard } from './guards/websocket-access-key.guard';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { TelemedicineMessage } from './model/telemedicine-message.entity';
import { TelemedicineSession } from './model/telemedicine-session.entity';
import { TelemedicineController } from './telemedicine.controller';
import { TelemedicineGateway } from './telemedicine.gateway';
import { TelemedicineService } from './telemedicine.service';

@Module({
  imports: [
    FireormModule.forFeature([TelemedicineSession, TelemedicineMessage]),
    forwardRef(() => AttentionModule),
    forwardRef(() => PatientHistoryModule),
    forwardRef(() => ClientModule),
    forwardRef(() => ClientPortalModule),
    forwardRef(() => CommerceModule),
    forwardRef(() => NotificationModule),
  ],
  controllers: [TelemedicineController],
  providers: [
    TelemedicineService,
    TelemedicineGateway,
    WebSocketAuthGuard,
    WebSocketAccessKeyGuard,
  ],
  exports: [TelemedicineService, TelemedicineGateway],
})
export class TelemedicineModule {}
