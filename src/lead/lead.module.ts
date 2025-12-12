import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { LeadContact } from './model/lead-contact.entity';
import { Lead } from './model/lead.entity';

@Module({
  imports: [FireormModule.forFeature([Lead, LeadContact])],
  providers: [LeadService],
  exports: [LeadService],
  controllers: [LeadController],
})
export class LeadModule {}
