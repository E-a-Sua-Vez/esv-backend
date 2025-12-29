import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { Prescription } from '../../prescription/model/prescription.entity';
import { MedicalExamOrder } from '../../medical-exam-order/model/medical-exam-order.entity';
import { MedicalReference } from '../../medical-reference/model/medical-reference.entity';
import { PatientHistory } from '../../patient-history/model/patient-history.entity';
import { Attention } from '../../attention/model/attention.entity';
import { AuditLog } from '../model/audit-log.entity';
import { DataRetentionService } from '../services/data-retention.service';
import { DataRetentionController } from '../controllers/data-retention.controller';

@Module({
  imports: [
    FireormModule.forFeature([
      Prescription,
      MedicalExamOrder,
      MedicalReference,
      PatientHistory,
      Attention,
      AuditLog,
    ]),
  ],
  providers: [DataRetentionService],
  controllers: [DataRetentionController],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}

