import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { FormPersonalized } from './model/form-personalized.entity';
import { FormPersonalizedService } from './form-personalized.service';
import { FormPersonalizedController } from './form-personalized.controller';

@Module({
  imports: [
    FireormModule.forFeature([FormPersonalized]),
    HttpModule
  ],
  providers: [
    FormPersonalizedService
  ],
  exports: [FormPersonalizedService],
  controllers: [FormPersonalizedController],
})
export class FormPersonalizedModule {}