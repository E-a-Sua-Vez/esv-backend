import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { CommerceController } from './commerce.controller';
import { Commerce } from './model/commerce.entity';
import { CommerceService } from './commerce.service';
import { QueueModule } from '../queue/queue.module';
import { FeatureToggleModule } from '../feature-toggle/feature-toggle.module';
import { SurveyPersonalizedModule } from '../survey-personalized/survey-personalized.module';
import { NotificationModule } from '../notification/notification.module';
import { HttpModule } from '@nestjs/axios';
import { QueryStackClient } from './infrastructure/query-stack-client';

@Module({
  imports: [
    FireormModule.forFeature([Commerce]),
    forwardRef(() => QueueModule),
    forwardRef(() => FeatureToggleModule),
    forwardRef(() => SurveyPersonalizedModule),
    forwardRef(() => NotificationModule),
    HttpModule
  ],
  providers: [
    CommerceService,
    QueryStackClient
  ],
  exports: [CommerceService],
  controllers: [CommerceController],
})
export class CommerceModule {}