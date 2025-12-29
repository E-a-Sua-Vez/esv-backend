import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AttentionModule } from 'src/attention/attention.module';
import { BookingBlockNumberUsedModule } from 'src/booking-block-number-used/booking-block-number-used.module';
import { ServiceModule } from 'src/service/service.module';

import { ClientModule } from '../client/client.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { CommerceModule } from '../commerce/commerce.module';
import { DocumentsModule } from '../documents/documents.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { IncomeModule } from '../income/income.module';
import { ModuleModule } from '../module/module.module';
import { NotificationModule } from '../notification/notification.module';
import { PackageModule } from '../package/package.module';
import { QueueModule } from '../queue/queue.module';
import { TelemedicineModule } from '../telemedicine/telemedicine.module';
import { UserModule } from '../user/user.module';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { AuditLogModule } from '../shared/modules/audit-log.module';
import { LgpdConsentModule } from '../shared/modules/lgpd-consent.module';

import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingDefaultBuilder } from './builders/booking-default';
import { Booking } from './model/booking.entity';

@Module({
  imports: [
    FireormModule.forFeature([Booking]),
    forwardRef(() => QueueModule),
    forwardRef(() => CollaboratorModule),
    forwardRef(() => CommerceModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => UserModule),
    forwardRef(() => ModuleModule),
    forwardRef(() => FeatureToggleModule),
    forwardRef(() => AttentionModule),
    forwardRef(() => WaitlistModule),
    forwardRef(() => ClientModule),
    forwardRef(() => IncomeModule),
    forwardRef(() => PackageModule),
    forwardRef(() => UserModule),
    forwardRef(() => ServiceModule),
    forwardRef(() => PackageModule),
    forwardRef(() => DocumentsModule),
    forwardRef(() => BookingBlockNumberUsedModule),
    forwardRef(() => TelemedicineModule),
    AuditLogModule,
    forwardRef(() => LgpdConsentModule),
  ],
  providers: [BookingService, BookingDefaultBuilder],
  exports: [BookingService],
  controllers: [BookingController],
})
export class BookingModule {}
