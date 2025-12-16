import { Module } from '@nestjs/common';

import { ClientModule } from '../client/client.module';
import { LaboratoryModule } from '../laboratory/laboratory.module';
import { MedicalExamOrderModule } from '../medical-exam-order/medical-exam-order.module';
import { NotificationModule } from '../notification/notification.module';

import { HL7ApiKeyGuard } from './guards/hl7-api-key.guard';
import { HL7MapperService } from './hl7-mapper.service';
import { HL7ParserService } from './hl7-parser.service';
import { HL7Controller } from './hl7.controller';
import { HL7Service } from './hl7.service';

@Module({
  imports: [MedicalExamOrderModule, NotificationModule, ClientModule, LaboratoryModule],
  controllers: [HL7Controller],
  providers: [HL7Service, HL7ParserService, HL7MapperService, HL7ApiKeyGuard],
  exports: [HL7Service],
})
export class HL7Module {}
