import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientModule } from '../client/client.module';
import { CommerceModule } from '../commerce/commerce.module';
import { PatientHistoryModule } from '../patient-history/patient-history.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationModule } from '../notification/notification.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { ProfessionalModule } from '../professional/professional.module';
import { GeneratedDocumentService } from '../shared/services/generated-document.service';
import { PdfTemplateModule } from '../shared/modules/pdf-template.module';
import { AuditLogModule } from '../shared/modules/audit-log.module';
import { DigitalSignatureModule } from '../shared/modules/digital-signature.module';
import { CrmValidationModule } from '../shared/modules/crm-validation.module';

import { MedicalReferencePdfService } from './medical-reference-pdf.service';
import { MedicalReferenceController } from './medical-reference.controller';
import { MedicalReferenceService } from './medical-reference.service';
import { ReferenceVerificationController } from './reference-verification.controller';
import { ReferenceSignatureController } from './reference-signature.controller';
import { MedicalReference } from './model/medical-reference.entity';

@Module({
  imports: [
    FireormModule.forFeature([MedicalReference]),
    ClientModule,
    CommerceModule,
    DocumentsModule,
    NotificationModule,
    CollaboratorModule,
    ProfessionalModule,
    PdfTemplateModule,
    AuditLogModule,
    DigitalSignatureModule,
    CrmValidationModule,
    forwardRef(() => PatientHistoryModule),
  ],
  providers: [MedicalReferenceService, MedicalReferencePdfService, GeneratedDocumentService],
  exports: [MedicalReferenceService, MedicalReferencePdfService],
  controllers: [
    MedicalReferenceController,
    ReferenceVerificationController,
    ReferenceSignatureController,
  ],
})
export class MedicalReferenceModule {}
