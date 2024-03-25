import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { WaitlistController } from './waitlist.controller';
import { Waitlist } from './model/waitlist.entity';
import { WaitlistService } from './waitlist.service';
import { QueueModule } from '../queue/queue.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { ModuleModule } from '../module/module.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { CommerceModule } from '../commerce/commerce.module';
import { WaitlistDefaultBuilder } from './builders/waitlist-default';
import { AttentionModule } from 'src/attention/attention.module';
import { ClientModule } from '../client/client.module';

@Module({
  imports: [
    FireormModule.forFeature([Waitlist]),
    forwardRef(() => QueueModule),
    forwardRef(() => CollaboratorModule),
    forwardRef(() => CommerceModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => UserModule),
    forwardRef(() => ModuleModule),
    forwardRef(() => FeatureToggleModule),
    forwardRef(() => AttentionModule),
    forwardRef(() => ClientModule)
  ],
  providers: [
    WaitlistService,
    WaitlistDefaultBuilder
  ],
  exports: [WaitlistService],
  controllers: [WaitlistController],
})
export class WaitlistModule {}