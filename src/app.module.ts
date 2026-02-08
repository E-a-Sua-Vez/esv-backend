import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { FireormModule } from 'nestjs-fireorm';

import { AdministratorModule } from './administrator/administrator.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttentionModule } from './attention/attention.module';
import { AuthModule } from './auth/auth.module';
import { BlockModule } from './block/block.module';
import { BookingModule } from './booking/booking.module';
import { BusinessModule } from './business/business.module';
import { BusinessLeadModule } from './business-lead/business-lead.module';
import { BusinessLogoModule } from './business-logo/business-logo.module';
import { CIE10Module } from './cie10/cie10.module';
import { ClientModule } from './client/client.module';
import { ClientContactModule } from './client-contact/client-contact.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { ClinicalAlertsModule } from './clinical-alerts/clinical-alerts.module';
import { CollaboratorModule } from './collaborator/collaborator.module';
import { CommerceModule } from './commerce/commerce.module';
import { CommerceLogoModule } from './commerce-logo/commerce-logo.module';
import { CompanyModule } from './company/company.module';
import { configValidationSchema } from './config/config.schema';
import { DocumentsModule } from './documents/documents.module';
import { FeatureModule } from './feature/feature.module';
import { FeatureToggleModule } from './feature-toggle/feature-toggle.module';
import { FormModule } from './form/form.module';
import { FormPersonalizedModule } from './form-personalized/form-personalized.module';
import { HealthModule } from './health/health.module';
import { HL7Module } from './hl7/hl7.module';
import { IncomeModule } from './income/income.module';
import { InternalMessageModule } from './internal-message/internal-message.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { LeadModule } from './lead/lead.module';
import { MedicalExamOrderModule } from './medical-exam-order/medical-exam-order.module';
import { MedicalReferenceModule } from './medical-reference/medical-reference.module';
import { MedicalTemplateModule } from './medical-template/medical-template.module';
import { ModuleModule } from './module/module.module';
import { NotificationModule } from './notification/notification.module';
import { OutcomeModule } from './outcome/outcome.module';
import { OutcomeTypeModule } from './outcome-type/outcome-type.module';
import { PackageModule } from './package/package.module';
import { PatientHistoryModule } from './patient-history/patient-history.module';
import { PatientHistoryItemModule } from './patient-history-item/patient-history-item.module';
import { PatientPhotoModule } from './patient-photo/patient-photo.module';
import { PaymentModule } from './payment/payment.module';
import { PlanModule } from './plan/plan.module';
import { PlanActivationModule } from './plan-activation/plan-activation.module';
import { PrescriptionModule } from './prescription/prescription.module';
import { ProductModule } from './product/product.module';
import { ProfessionalModule } from './professional/professional.module';
import { ProfessionalCommissionPaymentModule } from './professional-commission-payment/professional-commission-payment.module';
import { QueueModule } from './queue/queue.module';
import { RolModule } from './rol/rol.module';
import { ServiceModule } from './service/service.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { AuditInterceptor } from './shared/interceptors/audit.interceptor';
import { LoggerModule } from './shared/logger/logger.module';
import { LoggingInterceptor } from './shared/logger/logging.interceptor';
import { AuditLogModule } from './shared/modules/audit-log.module';
import { ConsentOrchestrationModule } from './shared/modules/consent-orchestration.module';
import { CrmValidationModule } from './shared/modules/crm-validation.module';
import { DataRetentionModule } from './shared/modules/data-retention.module';
import { DigitalSignatureModule } from './shared/modules/digital-signature.module';
import { LgpdConsentModule } from './shared/modules/lgpd-consent.module';
import { PdfTemplateModule } from './shared/modules/pdf-template.module';
import { SecurityModule } from './shared/security/security.module';
import { SuggestionModule } from './suggestion/suggestion.module';
import { SurveyModule } from './survey/survey.module';
import { SurveyPersonalizedModule } from './survey-personalized/survey-personalized.module';
import { TelemedicineModule } from './telemedicine/telemedicine.module';
import { UserModule } from './user/user.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    LoggerModule,
    SecurityModule,
    FireormModule.forRoot({
      firestoreSettings: {
        projectId: process.env.PROJECT_ID,
        ignoreUndefinedProperties: true,
      },
      fireormSettings: { validateModels: true },
    }),
    BusinessModule,
    CommerceModule,
    CollaboratorModule,
    AdministratorModule,
    AttentionModule,
    QueueModule,
    UserModule,
    SurveyModule,
    PaymentModule,
    NotificationModule,
    ModuleModule,
    HealthModule,
    FeatureToggleModule,
    PlanModule,
    RolModule,
    SuggestionModule,
    FeatureModule,
    PlanActivationModule,
    SurveyPersonalizedModule,
    BookingModule,
    WaitlistModule,
    BlockModule,
    ServiceModule,
    ClientModule,
    ClientContactModule,
    LeadModule,
    BusinessLeadModule,
    ProductModule,
    ProfessionalModule,
    ProfessionalCommissionPaymentModule,
    DocumentsModule,
    IncomeModule,
    OutcomeTypeModule,
    PackageModule,
    OutcomeModule,
    PatientHistoryModule,
    CompanyModule,
    PatientHistoryItemModule,
    PatientPhotoModule,
    BusinessLogoModule,
    CommerceLogoModule,
    PrescriptionModule,
    CIE10Module,
    ClinicalAlertsModule,
    MedicalExamOrderModule,
    MedicalReferenceModule,
    MedicalTemplateModule,
    HL7Module,
    LaboratoryModule,
    TelemedicineModule,
    FormModule,
    FormPersonalizedModule,
    InternalMessageModule,
    AuditLogModule,
    DigitalSignatureModule,
    CrmValidationModule,
    LgpdConsentModule,
    ConsentOrchestrationModule,
    DataRetentionModule,
    PdfTemplateModule,
    ClientPortalModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: `${process.env.NODE_ENV || 'local'}.env`,
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true, // Allow unknown env vars (for flexibility)
        abortEarly: false, // Show all validation errors at once
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window in milliseconds
        limit: 100, // Maximum number of requests per window
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
