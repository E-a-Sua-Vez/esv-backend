import { Module as ModuleDecorador } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';
import { PatientHistoryItemController } from './patient-history-item.controller';
import { PatientHistoryItem} from './model/patient-history-item.entity';
import { PatientHistoryItemService } from './patient-history-item.service';

@ModuleDecorador({
  imports: [
    FireormModule.forFeature([PatientHistoryItem])
  ],
  providers: [PatientHistoryItemService],
  exports: [PatientHistoryItemService],
  controllers: [PatientHistoryItemController],
})
export class PatientHistoryItemModule {}