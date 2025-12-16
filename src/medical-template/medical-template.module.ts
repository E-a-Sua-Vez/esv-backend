import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { MedicalTemplateController } from './medical-template.controller';
import { MedicalTemplateService } from './medical-template.service';
import { MedicalTemplate } from './model/medical-template.entity';

@Module({
  imports: [FireormModule.forFeature([MedicalTemplate])],
  controllers: [MedicalTemplateController],
  providers: [MedicalTemplateService],
  exports: [MedicalTemplateService],
})
export class MedicalTemplateModule {}
