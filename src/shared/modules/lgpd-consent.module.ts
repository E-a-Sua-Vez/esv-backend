import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { LgpdConsent } from '../model/lgpd-consent.entity';
import { LgpdIncident } from '../model/lgpd-incident.entity';
import { Client } from '../../client/model/client.entity';
import { Attention } from '../../attention/model/attention.entity';
import { Prescription } from '../../prescription/model/prescription.entity';
import { MedicalExamOrder } from '../../medical-exam-order/model/medical-exam-order.entity';
import { MedicalReference } from '../../medical-reference/model/medical-reference.entity';
import { PatientHistory } from '../../patient-history/model/patient-history.entity';
import { LgpdConsentService } from '../services/lgpd-consent.service';
import { LgpdDataPortabilityService } from '../services/lgpd-data-portability.service';
import { LgpdIncidentService } from '../services/lgpd-incident.service';
import { LgpdConsentController } from '../controllers/lgpd-consent.controller';
import { LgpdDataPortabilityController } from '../controllers/lgpd-data-portability.controller';
import { LgpdIncidentController } from '../controllers/lgpd-incident.controller';
import { AuditLogModule } from './audit-log.module';
import { NotificationModule } from '../../notification/notification.module';
import { ClientModule } from '../../client/client.module';
import { CommerceModule } from '../../commerce/commerce.module';
import { LgpdNotificationService } from '../services/lgpd-notification.service';

@Module({
  imports: [
    FireormModule.forFeature([
      LgpdConsent,
      LgpdIncident,
      Client,
      Attention,
      Prescription,
      MedicalExamOrder,
      MedicalReference,
      PatientHistory,
    ]),
    AuditLogModule,
    forwardRef(() => NotificationModule),
    forwardRef(() => ClientModule),
    forwardRef(() => CommerceModule),
  ],
  providers: [LgpdConsentService, LgpdDataPortabilityService, LgpdIncidentService, LgpdNotificationService],
  controllers: [
    LgpdConsentController,
    LgpdDataPortabilityController,
    LgpdIncidentController,
  ],
  exports: [LgpdConsentService, LgpdDataPortabilityService, LgpdIncidentService],
})
export class LgpdConsentModule {}
