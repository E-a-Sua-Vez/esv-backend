import { Module as ModuleDecorador } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { PatientHistoryController } from './patient-history.controller';
import { PatientHistory} from './model/patient-history.entity';
import { PatientHistoryService } from './patient-history.service';

@ModuleDecorador({
  imports: [
    FireormModule.forFeature([PatientHistory])
  ],
  providers: [PatientHistoryService],
  exports: [PatientHistoryService],
  controllers: [PatientHistoryController],
})
export class PatientHistoryModule {}