import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { ClientModule } from '../client/client.module';
import { CommerceModule } from '../commerce/commerce.module';
import { NotificationModule } from '../notification/notification.module';
import { LoggerModule } from '../shared/logger/logger.module';
import { ConsentOrchestrationModule } from '../shared/modules/consent-orchestration.module';
import { LgpdConsentModule } from '../shared/modules/lgpd-consent.module';
import { TelemedicineModule } from '../telemedicine/telemedicine.module';
import { DocumentsModule } from '../documents/documents.module';
import { AttentionModule } from '../attention/attention.module';

import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { ClientPortalSession } from './model/client-portal-session.entity';

@Module({
  imports: [
    FireormModule.forFeature([ClientPortalSession]),
    ClientModule,
    CommerceModule,
    NotificationModule,
    LoggerModule,
    ConsentOrchestrationModule,
    LgpdConsentModule,
    forwardRef(() => TelemedicineModule),
    forwardRef(() => DocumentsModule),
    forwardRef(() => AttentionModule),
  ],
  controllers: [ClientPortalController],
  providers: [ClientPortalService],
  exports: [ClientPortalService],
})
export class ClientPortalModule {}

