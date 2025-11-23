import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AttentionModule } from 'src/attention/attention.module';

import { ClientModule } from '../client/client.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { CommerceModule } from '../commerce/commerce.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { ModuleModule } from '../module/module.module';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';
import { UserModule } from '../user/user.module';

import { WaitlistDefaultBuilder } from './builders/waitlist-default';
import { Waitlist } from './model/waitlist.entity';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

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
    forwardRef(() => ClientModule),
  ],
  providers: [WaitlistService, WaitlistDefaultBuilder],
  exports: [WaitlistService],
  controllers: [WaitlistController],
})
export class WaitlistModule {}
