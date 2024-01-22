import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { AttentionModule } from 'src/attention/attention.module';
import { GoogleAiClient } from './infrastructure/google-ai-client';
import { SurveyController } from './survey.controller';
import { Survey } from './model/survey.entity';
import { SurveyService } from './survey.service';

@Module({
  imports: [
    FireormModule.forFeature([Survey]),
    forwardRef(() => AttentionModule),
    HttpModule
  ],
  providers: [
    SurveyService,
    GoogleAiClient
  ],
  exports: [SurveyService],
  controllers: [SurveyController],
})
export class SurveyModule {}