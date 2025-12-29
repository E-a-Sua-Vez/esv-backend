import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientModule } from '../client/client.module';
import { CommerceModule } from '../commerce/commerce.module';
import { MessageModule } from '../message/message.module';
import { PatientHistoryModule } from '../patient-history/patient-history.module';
import { ProductModule } from '../product/product.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationModule } from '../notification/notification.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { GeneratedDocumentService } from '../shared/services/generated-document.service';
import { PdfTemplateModule } from '../shared/modules/pdf-template.module';

import { MedicationCatalog } from './model/medication.entity';
import { Prescription } from './model/prescription.entity';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionVerificationController } from './prescription-verification.controller';
import { PrescriptionSignatureController } from './prescription-signature.controller';
import { PrescriptionService } from './prescription.service';
import { AuditLogModule } from '../shared/modules/audit-log.module';
import { DigitalSignatureModule } from '../shared/modules/digital-signature.module';
import { CrmValidationModule } from '../shared/modules/crm-validation.module';

@Module({
  imports: [
    FireormModule.forFeature([Prescription, MedicationCatalog]),
    ClientModule,
    CommerceModule,
    ProductModule,
    DocumentsModule,
    NotificationModule,
    CollaboratorModule,
    PdfTemplateModule,
    AuditLogModule,
    DigitalSignatureModule,
    CrmValidationModule,
    forwardRef(() => MessageModule),
    forwardRef(() => PatientHistoryModule),
  ],
  providers: [PrescriptionService, PrescriptionPdfService, GeneratedDocumentService],
  exports: [PrescriptionService, PrescriptionPdfService],
  controllers: [
    PrescriptionController,
    PrescriptionVerificationController,
    PrescriptionSignatureController,
  ],
})
export class PrescriptionModule {}
