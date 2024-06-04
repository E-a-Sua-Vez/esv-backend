import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { BookingController } from './booking.controller';
import { Booking } from './model/booking.entity';
import { BookingService } from './booking.service';
import { QueueModule } from '../queue/queue.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { ModuleModule } from '../module/module.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { CommerceModule } from '../commerce/commerce.module';
import { BookingDefaultBuilder } from './builders/booking-default';
import { AttentionModule } from 'src/attention/attention.module';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { ClientModule } from '../client/client.module';
import { IncomeModule } from '../income/income.module';
import { PackageModule } from '../package/package.module';
import { ServiceModule } from 'src/service/service.module';
import { DocumentsModule } from '../documents/documents.module';
import { BookingBlockNumberUsedModule } from 'src/booking-block-number-used/booking-block-number-used.module';

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
    forwardRef(() => BookingBlockNumberUsedModule)
  ],
  providers: [
    BookingService,
    BookingDefaultBuilder
  ],
  exports: [
    BookingService
  ],
  controllers: [BookingController],
})
export class BookingModule {}