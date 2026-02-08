import { forwardRef, Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientModule } from '../client/client.module';

import { BusinessLeadController } from './business-lead.controller';
import { BusinessLeadService } from './business-lead.service';
import { BusinessLeadContact } from './model/business-lead-contact.entity';
import { BusinessLead } from './model/business-lead.entity';

@Module({
  imports: [
    FireormModule.forFeature([BusinessLead, BusinessLeadContact]),
    forwardRef(() => ClientModule),
  ],
  providers: [BusinessLeadService],
  exports: [BusinessLeadService],
  controllers: [BusinessLeadController],
})
export class BusinessLeadModule {}
