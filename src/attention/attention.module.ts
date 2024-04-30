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
import { AttentionReserveBuilder } from './builders/attention-reserve';
import { ServiceModule } from 'src/service/service.module';
import { PackageModule } from 'src/package/package.module';
import { IncomeModule } from '../income/income.module';

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
    forwardRef(() => IncomeModule)
  ],
  providers: [
    AttentionService,
    AttentionDefaultBuilder,
    AttentionSurveyBuilder,
    AttentionNoDeviceBuilder,
    AttentionReserveBuilder
  ],
  exports: [AttentionService],
  controllers: [AttentionController],
})
export class AttentionModule {}