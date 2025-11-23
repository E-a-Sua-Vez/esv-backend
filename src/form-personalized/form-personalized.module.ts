import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { FormPersonalizedController } from './form-personalized.controller';
import { FormPersonalizedService } from './form-personalized.service';
import { FormPersonalized } from './model/form-personalized.entity';

@Module({
  imports: [FireormModule.forFeature([FormPersonalized]), HttpModule],
  providers: [FormPersonalizedService],
  exports: [FormPersonalizedService],
  controllers: [FormPersonalizedController],
})
export class FormPersonalizedModule {}
