import { Module } from '@nestjs/common';

import { CrmValidationService } from '../services/crm-validation.service';

@Module({
  providers: [CrmValidationService],
  exports: [CrmValidationService],
})
export class CrmValidationModule {}











