import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientModule } from '../client/client.module';
import { CommerceModule } from '../commerce/commerce.module';

import { MedicalReferencePdfService } from './medical-reference-pdf.service';
import { MedicalReferenceController } from './medical-reference.controller';
import { MedicalReferenceService } from './medical-reference.service';
import { MedicalReference } from './model/medical-reference.entity';

@Module({
  imports: [FireormModule.forFeature([MedicalReference]), ClientModule, CommerceModule],
  providers: [MedicalReferenceService, MedicalReferencePdfService],
  exports: [MedicalReferenceService, MedicalReferencePdfService],
  controllers: [MedicalReferenceController],
})
export class MedicalReferenceModule {}
