import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClinicalAlertsModule } from '../clinical-alerts/clinical-alerts.module';
import { NotificationModule } from '../notification/notification.module';
import { ClientModule } from '../client/client.module';
import { CommerceModule } from '../commerce/commerce.module';
import { PatientHistoryModule } from '../patient-history/patient-history.module';
import { DocumentsModule } from '../documents/documents.module';
import { CollaboratorModule } from '../collaborator/collaborator.module';
import { GeneratedDocumentService } from '../shared/services/generated-document.service';
import { PdfTemplateModule } from '../shared/modules/pdf-template.module';
import { AuditLogModule } from '../shared/modules/audit-log.module';
import { DigitalSignatureModule } from '../shared/modules/digital-signature.module';
import { CrmValidationModule } from '../shared/modules/crm-validation.module';
import { ExamResultTemplateController } from './exam-result-template.controller';
import { ExamResultTemplateService } from './exam-result-template.service';
import { ExamResultController } from './exam-result.controller';
import { ExamResultService } from './exam-result.service';
import { MedicalExamOrderPdfService } from './medical-exam-order-pdf.service';
import { MedicalExamOrderController } from './medical-exam-order.controller';
import { MedicalExamOrderService } from './medical-exam-order.service';
import { ExamOrderVerificationController } from './exam-order-verification.controller';
import { ExamOrderSignatureController } from './exam-order-signature.controller';
import { ExamResultTemplate } from './model/exam-result-template.entity';
import { MedicalExamOrder } from './model/medical-exam-order.entity';
import { MedicalExam } from './model/medical-exam.entity';

@Module({
  imports: [
    FireormModule.forFeature([MedicalExamOrder, MedicalExam, ExamResultTemplate]),
    forwardRef(() => ClinicalAlertsModule),
    forwardRef(() => NotificationModule),
    ClientModule,
    CommerceModule,
    DocumentsModule,
    CollaboratorModule,
    PdfTemplateModule,
    AuditLogModule,
    DigitalSignatureModule,
    CrmValidationModule,
    forwardRef(() => PatientHistoryModule),
  ],
  providers: [
    MedicalExamOrderService,
    ExamResultService,
    ExamResultTemplateService,
    MedicalExamOrderPdfService,
    GeneratedDocumentService,
  ],
  exports: [
    MedicalExamOrderService,
    ExamResultService,
    ExamResultTemplateService,
    MedicalExamOrderPdfService,
  ],
  controllers: [
    MedicalExamOrderController,
    ExamResultController,
    ExamResultTemplateController,
    ExamOrderVerificationController,
    ExamOrderSignatureController,
  ],
})
export class MedicalExamOrderModule {}
