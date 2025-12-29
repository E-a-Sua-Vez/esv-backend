import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { PdfTemplate } from '../model/pdf-template.entity';
import { PdfTemplateService } from '../services/pdf-template.service';
import { PdfTemplateController } from '../controllers/pdf-template.controller';

@Module({
  imports: [FireormModule.forFeature([PdfTemplate])],
  providers: [PdfTemplateService],
  controllers: [PdfTemplateController],
  exports: [PdfTemplateService],
})
export class PdfTemplateModule {}

