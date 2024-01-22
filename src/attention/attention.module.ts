import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AttentionController } from './attention.controller';
import { Attention } from './model/attention.entity';
import { AttentionService } from './attention.service';
import { QueueModule } from '../queue/queue.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { ModuleModule } from '../module/module.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { AttentionDefaultBuilder } from './builders/attention-default';
import { AttentionSurveyBuilder } from './builders/attention-survey';
import { CommerceModule } from '../commerce/commerce.module';
import { AttentionNoDeviceBuilder } from './builders/attention-no-device';

@Module({
  imports: [
    FireormModule.forFeature([Attention]),
    forwardRef(() => QueueModule),
    forwardRef(() => CollaboratorModule),
    forwardRef(() => CommerceModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => UserModule),
    forwardRef(() => ModuleModule),
    forwardRef(() => FeatureToggleModule)
  ],
  providers: [
    AttentionService,
    AttentionDefaultBuilder,
    AttentionSurveyBuilder,
    AttentionNoDeviceBuilder
  ],
  exports: [AttentionService],
  controllers: [AttentionController],
})
export class AttentionModule {}