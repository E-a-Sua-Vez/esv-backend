import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { CollaboratorModule } from '../collaborator/collaborator.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';
import { ServiceModule } from '../service/service.module';
import { SurveyPersonalizedModule } from '../survey-personalized/survey-personalized.module';

import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { QueryStackClient } from './infrastructure/query-stack-client';
import { Commerce } from './model/commerce.entity';

@Module({
  imports: [
    FireormModule.forFeature([Commerce]),
    forwardRef(() => QueueModule),
    forwardRef(() => FeatureToggleModule),
    forwardRef(() => SurveyPersonalizedModule),
    forwardRef(() => NotificationModule),
    HttpModule,
  ],
  providers: [CommerceService, QueryStackClient],
  exports: [CommerceService],
  controllers: [CommerceController],
})
export class CommerceModule {}
