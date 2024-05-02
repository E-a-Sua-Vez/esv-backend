
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FireormModule } from 'nestjs-fireorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommerceModule } from './commerce/commerce.module';
import { CollaboratorModule } from './collaborator/collaborator.module';
import { AdministratorModule } from './administrator/administrator.module';
import { AttentionModule } from './attention/attention.module';
import { QueueModule } from './queue/queue.module';
import { UserModule } from './user/user.module';
import { SurveyModule } from './survey/survey.module';
import { PaymentModule } from './payment/payment.module';
import { NotificationModule } from './notification/notification.module';
import { ModuleModule } from './module/module.module';
import { HealthModule } from './health/health.module';
import { FeatureToggleModule } from './feature-toggle/feature-toggle.module';
import { PlanModule } from './plan/plan.module';
import { BusinessModule } from './business/business.module';
import { RolModule } from './rol/rol.module';
import { SuggestionModule } from './suggestion/suggestion.module';
import { FeatureModule } from './feature/feature.module';
import { PlanActivationModule } from './plan-activation/plan-activation.module';
import { SurveyPersonalizedModule } from './survey-personalized/survey-personalized.module';
import { BookingModule } from './booking/booking.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { BlockModule } from './block/block.module';
import { ServiceModule } from './service/service.module';
import { ClientModule } from './client/client.module';
import { ClientContactModule } from './client-contact/client-contact.module';
import { ProductModule } from './product/product.module';
import { DocumentsModule } from './documents/documents.module';
import { IncomeModule } from './income/income.module';
import { OutcomeTypeModule } from './outcome-type/outcome-type.module';
import { PackageModule } from './package/package.module';
import { OutcomeModule } from './outcome/outcome.module';
import { PatientHistoryModule } from './patient-history/patient-history.module';
import { CompanyModule } from './company/company.module';
import { PatientHistoryItemModule } from './patient-history-item/patient-history-item.module';

@Module({
  imports: [
    FireormModule.forRoot({
      firestoreSettings: {
        projectId: process.env.PROJECT_ID,
        ignoreUndefinedProperties: true
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
    ProductModule,
    DocumentsModule,
    IncomeModule,
    OutcomeTypeModule,
    PackageModule,
    OutcomeModule,
    PatientHistoryModule,
    CompanyModule,
    PatientHistoryItemModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: `${process.env.NODE_ENV || 'local'}.env`
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
