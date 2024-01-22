import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { SurveyPersonalized } from './model/survey-personalized.entity';
import { SurveyPersonalizedService } from './survey-personalized.service';
import { SurveyPersonalizedController } from './survey-personalized.controller';

@Module({
  imports: [
    FireormModule.forFeature([SurveyPersonalized]),
    HttpModule
  ],
  providers: [
    SurveyPersonalizedService
  ],
  exports: [SurveyPersonalizedService],
  controllers: [SurveyPersonalizedController],
})
export class SurveyPersonalizedModule {}