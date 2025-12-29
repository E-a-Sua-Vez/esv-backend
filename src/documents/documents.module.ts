import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentIntegrationService } from './document-integration.service';
import { Document } from './model/document.entity';

@Module({
  imports: [FireormModule.forFeature([Document])],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIntegrationService],
  exports: [DocumentsService, DocumentIntegrationService],
})
export class DocumentsModule {}
