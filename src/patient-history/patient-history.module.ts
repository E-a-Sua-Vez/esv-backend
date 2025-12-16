import { Module as ModuleDecorador } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { Attention } from '../attention/model/attention.entity';
import { Booking } from '../booking/model/booking.entity';
import { MedicalExamOrder } from '../medical-exam-order/model/medical-exam-order.entity';
import { Prescription } from '../prescription/model/prescription.entity';

import { ConsultationHistoryService } from './consultation-history.service';
import { ConsultationHistory } from './model/consultation-history.entity';
import { PatientHistory } from './model/patient-history.entity';
import { PatientHistoryController } from './patient-history.controller';
import { PatientHistoryService } from './patient-history.service';
import { PatientJourneyService } from './patient-journey.service';

@ModuleDecorador({
  imports: [
    FireormModule.forFeature([
      PatientHistory,
      ConsultationHistory,
      Attention,
      Booking,
      Prescription,
      MedicalExamOrder,
    ]),
  ],
  providers: [PatientHistoryService, ConsultationHistoryService, PatientJourneyService],
  exports: [PatientHistoryService, ConsultationHistoryService, PatientJourneyService],
  controllers: [PatientHistoryController],
})
export class PatientHistoryModule {
  // Export ConsultationHistoryService for use in other modules
  static forRoot() {
    return {
      module: PatientHistoryModule,
      exports: [ConsultationHistoryService],
    };
  }
}
