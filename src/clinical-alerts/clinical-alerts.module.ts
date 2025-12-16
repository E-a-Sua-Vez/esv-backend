import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClinicalAlertsController } from './clinical-alerts.controller';
import { ClinicalAlertsService } from './clinical-alerts.service';
import { ClinicalAlert } from './model/clinical-alert.entity';

@Module({
  imports: [FireormModule.forFeature([ClinicalAlert])],
  providers: [ClinicalAlertsService],
  exports: [ClinicalAlertsService],
  controllers: [ClinicalAlertsController],
})
export class ClinicalAlertsModule {}
