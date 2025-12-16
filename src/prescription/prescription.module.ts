import { Module, forwardRef } from '@nestjs/common';
import { FireormModule } from 'nestjs-fireorm';

import { ClientModule } from '../client/client.module';
import { CommerceModule } from '../commerce/commerce.module';
import { MessageModule } from '../message/message.module';
import { PatientHistoryModule } from '../patient-history/patient-history.module';
import { ProductModule } from '../product/product.module';

import { MedicationCatalog } from './model/medication.entity';
import { Prescription } from './model/prescription.entity';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';

@Module({
  imports: [
    FireormModule.forFeature([Prescription, MedicationCatalog]),
    ClientModule,
    CommerceModule,
    ProductModule,
    forwardRef(() => MessageModule),
    forwardRef(() => PatientHistoryModule),
  ],
  providers: [PrescriptionService, PrescriptionPdfService],
  exports: [PrescriptionService, PrescriptionPdfService],
  controllers: [PrescriptionController],
})
export class PrescriptionModule {}
