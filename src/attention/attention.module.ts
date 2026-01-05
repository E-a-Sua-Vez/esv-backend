import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { DocumentsModule } from 'src/documents/documents.module';
import { PackageModule } from 'src/package/package.module';
import { ServiceModule } from 'src/service/service.module';

import { BookingModule } from '../booking/booking.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { CommerceModule } from '../commerce/commerce.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { IncomeModule } from '../income/income.module';
import { ModuleModule } from '../module/module.module';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';
import { TelemedicineModule } from '../telemedicine/telemedicine.module';
import { UserModule } from '../user/user.module';
import { AuditLogModule } from '../shared/modules/audit-log.module';
import { LgpdConsentModule } from '../shared/modules/lgpd-consent.module';
import { ConsentOrchestrationModule } from '../shared/modules/consent-orchestration.module';

import { AttentionController } from './attention.controller';
import { AttentionService } from './attention.service';
import { AttentionDefaultBuilder } from './builders/attention-default';
import { AttentionNoDeviceBuilder } from './builders/attention-no-device';
import { AttentionReserveBuilder } from './builders/attention-reserve';
import { AttentionSurveyBuilder } from './builders/attention-survey';
import { AttentionTelemedicineBuilder } from './builders/attention-telemedicine';
import { Attention } from './model/attention.entity';

@Module({
  imports: [
    FireormModule.forFeature([Attention]),
    forwardRef(() => QueueModule),
    forwardRef(() => CollaboratorModule),
    forwardRef(() => CommerceModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => UserModule),
    forwardRef(() => ModuleModule),
    forwardRef(() => FeatureToggleModule),
    forwardRef(() => ServiceModule),
    forwardRef(() => PackageModule),
    forwardRef(() => IncomeModule),
    forwardRef(() => DocumentsModule),
    forwardRef(() => TelemedicineModule),
    forwardRef(() => BookingModule),
    AuditLogModule,
    forwardRef(() => LgpdConsentModule),
    forwardRef(() => ConsentOrchestrationModule),
  ],
  providers: [
    AttentionService,
    AttentionDefaultBuilder,
    AttentionSurveyBuilder,
    AttentionNoDeviceBuilder,
    AttentionReserveBuilder,
    AttentionTelemedicineBuilder,
  ],
  exports: [AttentionService],
  controllers: [AttentionController],
})
export class AttentionModule {}
