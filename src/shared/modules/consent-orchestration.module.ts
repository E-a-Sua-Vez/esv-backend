import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ConsentRequirement } from '../model/consent-requirement.entity';
import { ConsentRequest } from '../model/consent-request.entity';
import { ConsentRequirementVersion } from '../model/consent-requirement-version.entity';
import { LgpdConsent } from '../model/lgpd-consent.entity';
import { ConsentOrchestrationService } from '../services/consent-orchestration.service';
import { ConsentTriggersService } from '../services/consent-triggers.service';
import { ConsentExpirationService } from '../services/consent-expiration.service';
import { ConsentValidationService } from '../services/consent-validation.service';
import { ConsentOrchestrationController } from '../controllers/consent-orchestration.controller';
import { LgpdConsentModule } from './lgpd-consent.module';
import { ClientModule } from '../../client/client.module';
import { CommerceModule } from '../../commerce/commerce.module';
import { NotificationModule } from '../../notification/notification.module';
import { AuditLogModule } from './audit-log.module';
import { FeatureToggleModule } from '../../feature-toggle/feature-toggle.module';

@Module({
  imports: [
    FireormModule.forFeature([
      ConsentRequirement,
      ConsentRequest,
      ConsentRequirementVersion,
      LgpdConsent,
    ]),
    forwardRef(() => LgpdConsentModule),
    forwardRef(() => ClientModule),
    forwardRef(() => CommerceModule),
    forwardRef(() => NotificationModule),
    AuditLogModule,
    forwardRef(() => FeatureToggleModule),
  ],
  providers: [
    ConsentOrchestrationService,
    ConsentTriggersService,
    ConsentExpirationService,
    ConsentValidationService,
  ],
  controllers: [ConsentOrchestrationController],
  exports: [
    ConsentOrchestrationService,
    ConsentTriggersService,
    ConsentExpirationService,
    ConsentValidationService,
  ],
})
export class ConsentOrchestrationModule {}

