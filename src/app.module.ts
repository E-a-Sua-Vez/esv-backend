import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
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
import { ClientModule } from './client/client.module';
import { ClientContactModule } from './client-contact/client-contact.module';
import { CollaboratorModule } from './collaborator/collaborator.module';
import { CommerceModule } from './commerce/commerce.module';
import { CompanyModule } from './company/company.module';
import { configValidationSchema } from './config/config.schema';
import { DocumentsModule } from './documents/documents.module';
import { FeatureModule } from './feature/feature.module';
import { FeatureToggleModule } from './feature-toggle/feature-toggle.module';
import { FormModule } from './form/form.module';
import { FormPersonalizedModule } from './form-personalized/form-personalized.module';
import { HealthModule } from './health/health.module';
import { IncomeModule } from './income/income.module';
import { LeadModule } from './lead/lead.module';
import { MessageModule } from './message/message.module';
import { ModuleModule } from './module/module.module';
import { NotificationModule } from './notification/notification.module';
import { OutcomeModule } from './outcome/outcome.module';
import { OutcomeTypeModule } from './outcome-type/outcome-type.module';
import { PackageModule } from './package/package.module';
import { PatientHistoryModule } from './patient-history/patient-history.module';
import { PatientHistoryItemModule } from './patient-history-item/patient-history-item.module';
import { PaymentModule } from './payment/payment.module';
import { PlanModule } from './plan/plan.module';
import { PlanActivationModule } from './plan-activation/plan-activation.module';
import { ProductModule } from './product/product.module';
import { QueueModule } from './queue/queue.module';
import { RolModule } from './rol/rol.module';
import { ServiceModule } from './service/service.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { LoggerModule } from './shared/logger/logger.module';
import { LoggingInterceptor } from './shared/logger/logging.interceptor';
import { SecurityModule } from './shared/security/security.module';
import { SuggestionModule } from './suggestion/suggestion.module';
import { SurveyModule } from './survey/survey.module';
import { SurveyPersonalizedModule } from './survey-personalized/survey-personalized.module';
import { UserModule } from './user/user.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
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
    ProductModule,
    DocumentsModule,
    IncomeModule,
    OutcomeTypeModule,
    PackageModule,
    OutcomeModule,
    PatientHistoryModule,
    CompanyModule,
    PatientHistoryItemModule,
    FormModule,
    FormPersonalizedModule,
    MessageModule,
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
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
