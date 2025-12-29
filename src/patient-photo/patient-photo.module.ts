import { Module } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { PatientPhotoController } from './patient-photo.controller';
import { PatientPhotoService } from './patient-photo.service';
import { PatientPhoto } from './model/patient-photo.entity';

@Module({
  imports: [FireormModule.forFeature([PatientPhoto])],
  controllers: [PatientPhotoController],
  providers: [PatientPhotoService],
  exports: [PatientPhotoService],
})
export class PatientPhotoModule {}












